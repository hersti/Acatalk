import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  threshold: number;
}

interface UserBadge {
  id: string;
  badge_id: string;
  earned_at: string;
  badge: Badge;
}

export function useBadges(userId?: string) {
  const { user } = useAuth();
  const targetId = userId || user?.id;
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    const [userBadgesRes, allBadgesRes] = await Promise.all([
      supabase
        .from("user_badges")
        .select("id, badge_id, earned_at, badges(id, key, name, description, category, icon, threshold)")
        .eq("user_id", targetId!),
      supabase.from("badges").select("*"),
    ]);
    
    const earned = (userBadgesRes.data || []).map((ub: any) => ({
      ...ub,
      badge: ub.badges,
    }));
    setBadges(earned);
    setAllBadges((allBadgesRes.data as Badge[]) || []);
    setLoading(false);
  }, [targetId]);

  useEffect(() => {
    if (!targetId) { setLoading(false); return; }
    void fetchBadges();
  }, [fetchBadges, targetId]);

  // Check and award badges based on activity
  const checkAndAwardBadges = async () => {
    if (!user?.id) return;
    
    const [postsRes, commentsRes, earnedRes] = await Promise.all([
      supabase.from("posts").select("id, content_type, helpful_count").eq("user_id", user.id),
      supabase.from("comments").select("id").eq("user_id", user.id),
      supabase.from("user_badges").select("badge_id, badges(key)").eq("user_id", user.id),
    ]);

    const posts = postsRes.data || [];
    const comments = commentsRes.data || [];
    const earnedKeys = new Set((earnedRes.data || []).map((e: any) => e.badges?.key));
    const allBadgesData = allBadges.length > 0 ? allBadges : (await supabase.from("badges").select("*")).data || [];

    const badgeMap = new Map((allBadgesData as Badge[]).map(b => [b.key, b]));
    const toAward: string[] = [];

    // First Upload
    if (!earnedKeys.has("first_upload") && posts.some(p => ["notes", "past_exams", "kaynaklar"].includes(p.content_type))) {
      const badge = badgeMap.get("first_upload");
      if (badge) toAward.push(badge.id);
    }

    // First Discussion
    if (!earnedKeys.has("first_discussion") && posts.some(p => p.content_type === "discussion")) {
      const badge = badgeMap.get("first_discussion");
      if (badge) toAward.push(badge.id);
    }

    // First Answer
    if (!earnedKeys.has("first_answer") && comments.length >= 1) {
      const badge = badgeMap.get("first_answer");
      if (badge) toAward.push(badge.id);
    }

    // Helpful 5
    const totalHelpful = posts.reduce((sum, p) => sum + (p.helpful_count || 0), 0);
    if (!earnedKeys.has("helpful_5") && totalHelpful >= 5) {
      const badge = badgeMap.get("helpful_5");
      if (badge) toAward.push(badge.id);
    }

    // Notes contributor (10 notes)
    if (!earnedKeys.has("notes_contributor") && posts.filter(p => p.content_type === "notes").length >= 10) {
      const badge = badgeMap.get("notes_contributor");
      if (badge) toAward.push(badge.id);
    }

    // Exam uploader (5 exams)
    if (!earnedKeys.has("exam_uploader") && posts.filter(p => p.content_type === "past_exams").length >= 5) {
      const badge = badgeMap.get("exam_uploader");
      if (badge) toAward.push(badge.id);
    }

    // Resource curator (5 resources)
    if (!earnedKeys.has("resource_curator") && posts.filter(p => p.content_type === "kaynaklar").length >= 5) {
      const badge = badgeMap.get("resource_curator");
      if (badge) toAward.push(badge.id);
    }

    // Discussion starter (10 discussions)
    if (!earnedKeys.has("discussion_starter") && posts.filter(p => p.content_type === "discussion").length >= 10) {
      const badge = badgeMap.get("discussion_starter");
      if (badge) toAward.push(badge.id);
    }

    // Top contributor (50 posts)
    if (!earnedKeys.has("top_contributor") && posts.length >= 50) {
      const badge = badgeMap.get("top_contributor");
      if (badge) toAward.push(badge.id);
    }

    if (toAward.length > 0) {
      const inserts = toAward.map(badgeId => ({ user_id: user.id, badge_id: badgeId }));
      await supabase.from("user_badges").insert(inserts);
      void fetchBadges();
    }
  };

  return { badges, allBadges, loading, checkAndAwardBadges };
}
