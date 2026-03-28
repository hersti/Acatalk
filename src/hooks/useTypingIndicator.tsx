import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingUser {
  user_id: string;
  username: string;
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
            const p = presences[0] as any;
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

export function TypingIndicator({ typingUsers }: { typingUsers: TypingUser[] }) {
  if (typingUsers.length === 0) return null;

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0].username} yazıyor`
      : typingUsers.length === 2
        ? `${typingUsers[0].username} ve ${typingUsers[1].username} yazıyor`
        : `${typingUsers[0].username} ve ${typingUsers.length - 1} kişi yazıyor`;

  return (
    <div className="px-4 py-1.5 text-[11px] text-muted-foreground animate-pulse flex items-center gap-1.5">
      <span className="flex gap-0.5">
        <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      {text}...
    </div>
  );
}
