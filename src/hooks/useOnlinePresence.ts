import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOnlinePresence(channelName: string, userId: string | undefined) {
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    if (!userId || !channelName) return;

    const channel = supabase.channel(`presence-${channelName}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, userId]);

  return onlineCount;
}
