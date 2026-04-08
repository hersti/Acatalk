import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useFollow(targetUserId?: string) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"none" | "pending_sent" | "pending_received" | "accepted" | "rejected">("none");
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user?.id || !targetUserId || user.id === targetUserId) return;
    
    const [followRes, connRes1, connRes2] = await Promise.all([
      supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", targetUserId).maybeSingle(),
      supabase.from("connections").select("status").eq("requester_id", user.id).eq("target_id", targetUserId).maybeSingle(),
      supabase.from("connections").select("status").eq("requester_id", targetUserId).eq("target_id", user.id).maybeSingle(),
    ]);
    
    setIsFollowing(!!followRes.data);
    
    if (connRes1.data) {
      const s = (connRes1.data as any).status;
      if (s === "pending") setConnectionStatus("pending_sent");
      else if (s === "accepted") setConnectionStatus("accepted");
      else if (s === "rejected") setConnectionStatus("rejected");
      else setConnectionStatus("none");
    } else if (connRes2.data) {
      const s = (connRes2.data as any).status;
      if (s === "pending") setConnectionStatus("pending_received");
      else if (s === "accepted") setConnectionStatus("accepted");
      else if (s === "rejected") setConnectionStatus("rejected");
      else setConnectionStatus("none");
    } else {
      setConnectionStatus("none");
    }
  }, [targetUserId, user?.id]);

  const fetchCounts = useCallback(async () => {
    if (!targetUserId) return;
    const [followersRes, followingRes] = await Promise.all([
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", targetUserId),
      supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", targetUserId),
    ]);
    setFollowersCount(followersRes.count ?? 0);
    setFollowingCount(followingRes.count ?? 0);
  }, [targetUserId]);

  useEffect(() => {
    if (!targetUserId) return;
    void fetchStatus();
    void fetchCounts();
  }, [fetchCounts, fetchStatus, targetUserId]);

  const toggleFollow = useCallback(async () => {
    if (!user?.id || !targetUserId || loading) return;
    setLoading(true);
    try {
      if (isFollowing) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
        setIsFollowing(false);
        setFollowersCount(c => Math.max(0, c - 1));
      } else {
        await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
        setIsFollowing(true);
        setFollowersCount(c => c + 1);

        // Anti-spam: check if a follow notification was sent recently (last 24h)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", targetUserId)
          .eq("type", "follow")
          .eq("link", `/user/${user.id}`)
          .gte("created_at", oneDayAgo)
          .limit(1);

        if (!recentNotif || recentNotif.length === 0) {
          await supabase.from("notifications").insert({
            user_id: targetUserId,
            type: "follow",
            title: "Yeni takipçi",
            message: "Sizi takip etmeye başladı.",
            link: `/user/${user.id}`,
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId, isFollowing, loading]);

  const requestConnection = useCallback(async () => {
    if (!user?.id || !targetUserId || loading) return;
    setLoading(true);
    try {
      // Check if target user has blocked connection requests
      const { data: targetSettings } = await supabase
        .from("user_settings")
        .select("connection_requests_blocked")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (targetSettings?.connection_requests_blocked) {
        // Notify requester
        const { data: targetProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", targetUserId)
          .maybeSingle();
        const targetName = (targetProfile as any)?.username || "Bu kullanıcı";
        setLoading(false);
        // We can't use toast here since it's a hook, so we throw to be caught
        throw new Error(`${targetName} bağlantı isteklerini kabul etmiyor.`);
      }

      // Check if a connection already exists (in any direction)
      const { data: existing } = await supabase
        .from("connections")
        .select("id, status")
        .or(`and(requester_id.eq.${user.id},target_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},target_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        const s = (existing as any).status;
        if (s === "accepted") {
          setConnectionStatus("accepted");
          return;
        }
        if (s === "pending") {
          setConnectionStatus("pending_sent");
          return;
        }
        // If rejected, update to pending again
        await supabase.from("connections").update({ status: "pending", requester_id: user.id, target_id: targetUserId, responded_at: null } as any).eq("id", (existing as any).id);
        setConnectionStatus("pending_sent");
      } else {
        await supabase.from("connections").insert({ requester_id: user.id, target_id: targetUserId });
        setConnectionStatus("pending_sent");
      }

      await supabase.from("notifications").insert({
        user_id: targetUserId,
        type: "connection_request",
        title: "Bağlantı isteği",
        message: "Size bağlantı isteği gönderdi.",
        link: `/user/${user.id}`,
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId, loading]);

  const respondToConnection = useCallback(async (accept: boolean) => {
    if (!user?.id || !targetUserId || loading) return;
    setLoading(true);
    try {
      await supabase.from("connections")
        .update({ status: accept ? "accepted" : "rejected", responded_at: new Date().toISOString() })
        .or(`and(requester_id.eq.${targetUserId},target_id.eq.${user.id}),and(requester_id.eq.${user.id},target_id.eq.${targetUserId})`);
      setConnectionStatus(accept ? "accepted" : "rejected");
      if (accept) {
        await supabase.from("notifications").insert({
          user_id: targetUserId,
          type: "connection_accepted",
          title: "Bağlantı kabul edildi",
          message: "Bağlantı isteğiniz kabul edildi.",
          link: `/user/${user.id}`,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, targetUserId, loading]);

  return {
    isFollowing, connectionStatus, followersCount, followingCount, loading,
    toggleFollow, requestConnection, respondToConnection, refetch: () => { void fetchStatus(); void fetchCounts(); },
  };
}
