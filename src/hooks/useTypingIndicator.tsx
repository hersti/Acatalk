import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingUser {
  user_id: string;
  username: string;
}

export type { TypingUser };

type TypingPresenceState = {
  is_typing?: boolean;
  username?: string;
};

function getTypingPresence(value: unknown): TypingPresenceState | null {
  if (!value || typeof value !== "object") return null;
  return value as TypingPresenceState;
}

export function useTypingIndicator(channelName: string, userId: string | undefined, username: string | undefined) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId || !channelName) return;

    const channel = supabase.channel(`typing-${channelName}`, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== userId) {
            const p = getTypingPresence(presences[0]);
            if (p?.is_typing) {
              users.push({ user_id: key, username: p.username || "Birisi" });
            }
          }
        });
        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, username: username || "Kullanıcı", is_typing: false });
        }
      });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, userId, username]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current || !userId) return;

    channelRef.current.track({
      user_id: userId,
      username: username || "Kullanıcı",
      is_typing: true,
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      channelRef.current?.track({
        user_id: userId,
        username: username || "Kullanıcı",
        is_typing: false,
      });
    }, 3000);
  }, [userId, username]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !userId) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    channelRef.current.track({
      user_id: userId,
      username: username || "Kullanıcı",
      is_typing: false,
    });
  }, [userId, username]);

  return { typingUsers, sendTyping, stopTyping };
}
