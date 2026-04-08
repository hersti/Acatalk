import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchDmUnreadOverview } from "@/features/inbox/lib/dm-unread";

type InboxCountersState = {
  unreadMessages: number;
  unreadNotifications: number;
  loading: boolean;
  error: string | null;
};

const REFRESH_INTERVAL_MS = 30000;

export function useInboxCounters(userId: string | undefined) {
  const [state, setState] = useState<InboxCountersState>({
    unreadMessages: 0,
    unreadNotifications: 0,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({
        unreadMessages: 0,
        unreadNotifications: 0,
        loading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [notificationsResult, dmOverview] = await Promise.all([
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("is_read", false),
        fetchDmUnreadOverview(),
      ]);

      if (notificationsResult.error) {
        throw new Error(notificationsResult.error.message || "Notifications unread count fetch failed.");
      }

      setState({
        unreadMessages: dmOverview.totalUnread,
        unreadNotifications: notificationsResult.count || 0,
        loading: false,
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Inbox counters fetch failed.",
      }));
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`inbox-counters-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `user1_id=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `user2_id=eq.${userId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  return useMemo(
    () => ({
      unreadMessages: state.unreadMessages,
      unreadNotifications: state.unreadNotifications,
      loading: state.loading,
      error: state.error,
      refresh,
    }),
    [refresh, state.error, state.loading, state.unreadMessages, state.unreadNotifications],
  );
}
