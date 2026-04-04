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
  displayName: string;
  avatarUrl: string | null;
}

export interface CourseChatRoomSnapshot {
  id: string;
  messageCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

type RawCourseChatMessage = Tables<"course_chat_messages">;
type RawCourseChatRoom = Tables<"course_chat_rooms">;

interface UseCourseChatOptions {
  courseId: string;
  enabled: boolean;
  userId?: string;
}

const TABLE_MISSING_CODE = "42P01";
const UNIQUE_VIOLATION_CODE = "23505";
const FEATURE_UNAVAILABLE = "FEATURE_UNAVAILABLE";
type RoomLookupResult = CourseChatRoomSnapshot | null | typeof FEATURE_UNAVAILABLE;

const getErrorCode = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Ders sohbeti su anda yuklenemiyor.";
};

const toRoomSnapshot = (room: RawCourseChatRoom): CourseChatRoomSnapshot => ({
  id: room.id,
  messageCount: room.message_count ?? 0,
  lastMessageAt: room.last_message_at,
  lastMessagePreview: room.last_message_preview,
});

const upsertMessage = (prev: CourseChatMessage[], next: CourseChatMessage): CourseChatMessage[] => {
  const withoutCurrent = prev.filter((message) => message.id !== next.id);
  withoutCurrent.push(next);
  withoutCurrent.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return withoutCurrent;
};

export function useCourseChat({ courseId, enabled, userId }: UseCourseChatOptions) {
  const [messages, setMessages] = useState<CourseChatMessage[]>([]);
  const [room, setRoom] = useState<CourseChatRoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [featureUnavailable, setFeatureUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enrichMessages = useCallback(async (rows: RawCourseChatMessage[]): Promise<CourseChatMessage[]> => {
    if (rows.length === 0) return [];

    const userIds = [...new Set(rows.map((message) => message.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((profile) => {
        const username = profile.username || "kullanici";
        const displayName = profile.display_name || profile.username || "Kullanici";
        return [profile.user_id, { username, displayName, avatarUrl: profile.avatar_url }];
      }),
    );

    return rows.map((row) => {
      const sender = profileMap.get(row.user_id);
      return {
        ...row,
        username: sender?.username || "kullanici",
        displayName: sender?.displayName || "Kullanici",
        avatarUrl: sender?.avatarUrl || null,
      };
    });
  }, []);

  const fetchRoom = useCallback(async (): Promise<RoomLookupResult> => {
    const { data, error: roomError } = await supabase
      .from("course_chat_rooms")
      .select("id, message_count, last_message_at, last_message_preview")
      .eq("course_id", courseId)
      .maybeSingle();

    if (roomError) {
      if (getErrorCode(roomError) === TABLE_MISSING_CODE) return FEATURE_UNAVAILABLE;
      throw roomError;
    }

    const rawRoom = data as RawCourseChatRoom | null;
    return rawRoom ? toRoomSnapshot(rawRoom) : null;
  }, [courseId]);

  const fetchMessages = useCallback(async (): Promise<boolean> => {
    if (!enabled || !courseId) return false;

    setLoading(true);
    try {
      const resolvedRoom = await fetchRoom();
      if (resolvedRoom === FEATURE_UNAVAILABLE) {
        setFeatureUnavailable(true);
        setError(null);
        setRoom(null);
        setMessages([]);
        return false;
      }

      if (!resolvedRoom) {
        setFeatureUnavailable(false);
        setError(null);
        setRoom(null);
        setMessages([]);
        return true;
      }

      setRoom(resolvedRoom);

      const { data, error: messageError } = await supabase
        .from("course_chat_messages")
        .select("id, room_id, course_id, user_id, content, created_at, edited_at, is_deleted, is_pinned")
        .eq("course_id", courseId)
        .eq("is_deleted", false)
        .order("created_at", { ascending: true })
        .limit(120);

      if (messageError) {
        if (getErrorCode(messageError) === TABLE_MISSING_CODE) {
          setFeatureUnavailable(true);
          setError(null);
          return false;
        }
        throw messageError;
      }

      const hydrated = await enrichMessages((data || []) as RawCourseChatMessage[]);
      setMessages(hydrated);
      setFeatureUnavailable(false);
      setError(null);
      return true;
    } catch (caughtError: unknown) {
      setError(getErrorMessage(caughtError));
      return false;
    } finally {
      setLoading(false);
    }
  }, [courseId, enabled, enrichMessages, fetchRoom]);

  const markAsRead = useCallback(
    async (roomId: string, lastMessageId: string | null) => {
      if (!userId) return;

      const { error: readError } = await supabase
        .from("course_chat_reads")
        .upsert(
          {
            room_id: roomId,
            user_id: userId,
            last_read_message_id: lastMessageId,
            last_read_at: new Date().toISOString(),
            unread_count_cache: 0,
          },
          { onConflict: "room_id,user_id" },
        );

      if (readError && getErrorCode(readError) !== TABLE_MISSING_CODE) {
        // Read-state failure should not break chat UX.
        console.warn("course_chat_reads upsert failed", readError.message);
      }
    },
    [userId],
  );

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    if (!enabled || !courseId) {
      setLoading(false);
      return;
    }

    setRoom(null);
    setMessages([]);
    setError(null);

    void fetchMessages().then((available) => {
      if (!available) return;

      channel = supabase
        .channel(`course-chat-${courseId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "course_chat_messages",
            filter: `course_id=eq.${courseId}`,
          },
          async (payload) => {
            try {
              const raw = payload.new as RawCourseChatMessage;
              if (raw.is_deleted) return;

              const hydrated = await enrichMessages([raw]);
              const [nextMessage] = hydrated;
              if (!nextMessage) return;

              setMessages((prev) => upsertMessage(prev, nextMessage));
            } catch (caughtError: unknown) {
              setError(getErrorMessage(caughtError));
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "course_chat_messages",
            filter: `course_id=eq.${courseId}`,
          },
          async (payload) => {
            try {
              const raw = payload.new as RawCourseChatMessage;
              if (raw.is_deleted) {
                setMessages((prev) => prev.filter((message) => message.id !== raw.id));
                return;
              }

              const hydrated = await enrichMessages([raw]);
              const [nextMessage] = hydrated;
              if (!nextMessage) return;

              setMessages((prev) => upsertMessage(prev, nextMessage));
            } catch (caughtError: unknown) {
              setError(getErrorMessage(caughtError));
            }
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            setError("Canli sohbet baglantisi kesildi. Sayfayi yenileyerek tekrar deneyin.");
          }
        });
    });

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [courseId, enabled, enrichMessages, fetchMessages]);

  useEffect(() => {
    if (!enabled || !room?.id || !userId) return;
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    void markAsRead(room.id, lastMessageId);
  }, [enabled, markAsRead, messages, room?.id, userId]);

  const sendMessage = useCallback(
    async (senderUserId: string, content: string) => {
      setSending(true);
      try {
        let resolvedRoom = room ?? (await fetchRoom());
        if (resolvedRoom === FEATURE_UNAVAILABLE) {
          setFeatureUnavailable(true);
          return { ok: false, message: "Ders sohbeti yakinda acilacak." };
        }

        if (!resolvedRoom) {
          const { data: createdRoom, error: roomError } = await supabase
            .from("course_chat_rooms")
            .insert({ course_id: courseId })
            .select("id, message_count, last_message_at, last_message_preview")
            .single();

          if (roomError) {
            if (getErrorCode(roomError) === UNIQUE_VIOLATION_CODE) {
              const retryRoom = await fetchRoom();
              if (retryRoom === FEATURE_UNAVAILABLE) {
                setFeatureUnavailable(true);
                return { ok: false, message: "Ders sohbeti yakinda acilacak." };
              }
              if (!retryRoom) return { ok: false, message: "Sohbet odasi bulunamadi." };
              resolvedRoom = retryRoom;
            } else {
              return { ok: false, message: roomError.message };
            }
          } else {
            resolvedRoom = toRoomSnapshot(createdRoom as RawCourseChatRoom);
          }

          setRoom(resolvedRoom);
        }

        const { data: insertedMessage, error: insertError } = await supabase
          .from("course_chat_messages")
          .insert({
            room_id: resolvedRoom.id,
            course_id: courseId,
            user_id: senderUserId,
            content,
          })
          .select("id, room_id, course_id, user_id, content, created_at, edited_at, is_deleted, is_pinned")
          .single();

        if (insertError) {
          if (getErrorCode(insertError) === TABLE_MISSING_CODE) {
            setFeatureUnavailable(true);
            return { ok: false, message: "Ders sohbeti yakinda acilacak." };
          }
          return { ok: false, message: insertError.message };
        }

        const hydrated = await enrichMessages([insertedMessage as RawCourseChatMessage]);
        const [nextMessage] = hydrated;
        if (nextMessage) {
          setMessages((prev) => upsertMessage(prev, nextMessage));
          void markAsRead(resolvedRoom.id, nextMessage.id);
        }

        setError(null);
        return { ok: true, message: null };
      } catch (caughtError: unknown) {
        return { ok: false, message: getErrorMessage(caughtError) };
      } finally {
        setSending(false);
      }
    },
    [courseId, enrichMessages, fetchRoom, markAsRead, room],
  );

  return useMemo(
    () => ({
      messages,
      room,
      loading,
      sending,
      featureUnavailable,
      error,
      sendMessage,
      refresh: fetchMessages,
    }),
    [error, featureUnavailable, fetchMessages, loading, messages, room, sendMessage, sending],
  );
}
