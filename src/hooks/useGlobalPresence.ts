import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Global user presence system.
 * Tracks which users are currently online via a shared Supabase Presence channel.
 * Respects ghost_mode: if enabled, user won't appear online to others.
 */

const CHANNEL_NAME = "global-presence";
let globalOnlineUsers = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

let channelInstance: ReturnType<typeof supabase.channel> | null = null;
let trackedUserId: string | null = null;

export function useGlobalPresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId || trackedUserId === userId) return;

    // Check ghost mode before tracking
    const setupPresence = async () => {
      const { data: settings } = await supabase
        .from("user_settings")
        .select("ghost_mode")
        .eq("user_id", userId)
        .maybeSingle();

      const isGhost = (settings as any)?.ghost_mode === true;

      // Clean up previous
      if (channelInstance) {
        supabase.removeChannel(channelInstance);
      }

      trackedUserId = userId;

      // If ghost mode, don't join presence channel
      if (isGhost) {
        channelInstance = null;
        return;
      }

      const channel = supabase.channel(CHANNEL_NAME, {
        config: { presence: { key: userId } },
      });
      channelInstance = channel;

      channel
        .on("presence", { event: "sync" }, () => {
          const state = channel.presenceState();
          globalOnlineUsers = new Set(Object.keys(state));
          notify();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ user_id: userId, online_at: new Date().toISOString() });
          }
        });
    };

    setupPresence();

    return () => {
      if (channelInstance) {
        supabase.removeChannel(channelInstance);
        channelInstance = null;
        trackedUserId = null;
        globalOnlineUsers.clear();
        notify();
      }
    };
  }, [userId]);
}

export function useIsUserOnline(targetUserId: string | undefined): boolean {
  const [online, setOnline] = useState(false);

  useEffect(() => {
    if (!targetUserId) return;

    const update = () => setOnline(globalOnlineUsers.has(targetUserId));
    update();
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, [targetUserId]);

  return online;
}

export function useOnlineUsers(userIds: string[]): Set<string> {
  const [onlineSet, setOnlineSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    const update = () => {
      const newSet = new Set(userIds.filter((id) => globalOnlineUsers.has(id)));
      setOnlineSet(newSet);
    };
    update();
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, [userIds]);

  return onlineSet;
}
