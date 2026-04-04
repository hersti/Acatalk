import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

export interface CourseChatMessage {
  id: string;
  room_id: string;
  course_id: string;
  user_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  is_deleted: boolean;
  is_pinned: boolean;
  username: string;
}

type RawCourseChatMessage = Tables<"course_chat_messages">;
type RoomIdRow = Pick<Tables<"course_chat_rooms">, "id">;

interface UseCourseChatOptions {
  courseId: string;
  enabled: boolean;
}

const TABLE_MISSING_CODE = "42P01";
const UNIQUE_VIOLATION_CODE = "23505";
const FEATURE_UNAVAILABLE = "FEATURE_UNAVAILABLE";
type RoomLookupResult = string | null | typeof FEATURE_UNAVAILABLE;

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

export function useCourseChat({ courseId, enabled }: UseCourseChatOptions) {
  const [messages, setMessages] = useState<CourseChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);

  const enrichMessages = useCallback(async (rows: RawCourseChatMessage[]) => {
    if (rows.length === 0) return [];

    const userIds = [...new Set(rows.map((message) => message.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((profile) => [profile.user_id, profile.username || "Kullanici"]),
    );

    return rows.map((row) => ({
      ...row,
      username: profileMap.get(row.user_id) || "Kullanici",
    }));
  }, []);

  const fetchRoom = useCallback(async (): Promise<RoomLookupResult> => {
    const { data, error } = await supabase
      .from("course_chat_rooms")
      .select("id")
      .eq("course_id", courseId)
      .maybeSingle();

    if (error) {
      if (getErrorCode(error) === TABLE_MISSING_CODE) {
        return FEATURE_UNAVAILABLE;
      }
      throw error;
    }

    const room = data as RoomIdRow | null;
    return room?.id || null;
  }, [courseId]);

  const fetchMessages = useCallback(async (): Promise<boolean> => {
    if (!enabled || !courseId) return false;

    setLoading(true);
    try {
      const resolvedRoomId = await fetchRoom();
      if (resolvedRoomId === FEATURE_UNAVAILABLE) {
        setFeatureUnavailable(true);
        setRoomId(null);
        setMessages([]);
        return false;
      }

      if (!resolvedRoomId) {
        setRoomId(null);
        setMessages([]);
        setFeatureUnavailable(false);
        return true;
      }

      setRoomId(resolvedRoomId);

      const { data, error } = await supabase
        .from("course_chat_messages")
        .select("id, room_id, course_id, user_id, content, created_at, edited_at, is_deleted, is_pinned")
        .eq("course_id", courseId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(120);

      if (error) {
        if (getErrorCode(error) === TABLE_MISSING_CODE) {
          setFeatureUnavailable(true);
          return false;
        }
        throw error;
      }

      const hydrated = await enrichMessages((data || []) as RawCourseChatMessage[]);
      setMessages(hydrated);
      setFeatureUnavailable(false);
      return true;
    } finally {
      setLoading(false);
    }
  }, [courseId, enabled, enrichMessages, fetchRoom]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    if (!enabled || !courseId) {
      setLoading(false);
      return;
    }

    setRoomId(null);
    setMessages([]);

    void fetchMessages()
      .then((available) => {
        if (!available) return;

        channel = supabase
          .channel(`course-chat-${courseId}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "course_chat_messages", filter: `course_id=eq.${courseId}` },
            async (payload) => {
              const raw = payload.new as RawCourseChatMessage;
              if (raw.is_deleted) return;

              const hydrated = await enrichMessages([raw]);
              const [nextMessage] = hydrated;
              if (!nextMessage) return;

              setMessages((prev) => {
                if (prev.some((message) => message.id === nextMessage.id)) return prev;
                return [...prev, nextMessage];
              });
            },
          )
          .subscribe();
      })
      .catch(() => {
        setFeatureUnavailable(true);
        setLoading(false);
      });

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [courseId, enabled, enrichMessages, fetchMessages]);

  const sendMessage = useCallback(
    async (userId: string, content: string) => {
      setSending(true);
      try {
        let roomToUse = roomId || (await fetchRoom());
        if (roomToUse === FEATURE_UNAVAILABLE) {
          setFeatureUnavailable(true);
          return { ok: false, message: "Ders sohbeti yakinda acilacak." };
        }

        if (!roomToUse) {
          const { data: createdRoom, error: roomError } = await supabase
            .from("course_chat_rooms")
            .insert({ course_id: courseId })
            .select("id")
            .single();

          if (roomError) {
            if (getErrorCode(roomError) === UNIQUE_VIOLATION_CODE) {
              const resolvedRoomId = await fetchRoom();
              if (resolvedRoomId === FEATURE_UNAVAILABLE) {
                setFeatureUnavailable(true);
                return { ok: false, message: "Ders sohbeti yakinda acilacak." };
              }
              if (!resolvedRoomId) return { ok: false, message: "Sohbet odasi bulunamadi." };
              roomToUse = resolvedRoomId;
            } else {
              return { ok: false, message: roomError.message };
            }
          } else {
            roomToUse = createdRoom.id;
          }

          setRoomId(roomToUse);
        }

        const { error } = await supabase.from("course_chat_messages").insert({
          room_id: roomToUse,
          course_id: courseId,
          user_id: userId,
          content,
        });

        if (error) {
          if (getErrorCode(error) === TABLE_MISSING_CODE) {
            setFeatureUnavailable(true);
            return { ok: false, message: "Ders sohbeti yakinda acilacak." };
          }
          return { ok: false, message: error.message };
        }

        return { ok: true, message: null };
      } finally {
        setSending(false);
      }
    },
    [courseId, fetchRoom, roomId],
  );

  return useMemo(
    () => ({
      messages,
      loading,
      sending,
      featureUnavailable,
      sendMessage,
      refresh: fetchMessages,
    }),
    [featureUnavailable, fetchMessages, loading, messages, sendMessage, sending],
  );
}
