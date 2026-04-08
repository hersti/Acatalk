import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

interface ContributorSignal {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  university: string | null;
  department: string | null;
  class_year: number | null;
  posts_30d: number;
  comments_30d: number;
  chat_messages_30d: number;
  helpful_positive: number;
  post_comment_count_sum: number;
  activity_score: number;
  quality_score: number;
  course_reputation_v1: number;
  same_university: boolean;
  same_department: boolean;
  same_class_year: boolean;
}

interface FeaturedContentSignal {
  post_id: string;
  title: string;
  content_type: "notes" | "past_exams" | "discussion" | "kaynaklar";
  created_at: string;
  helpful_count: number;
  comment_count: number;
  featured_v1: number;
  author_user_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  author_university: string | null;
  author_department: string | null;
  author_class_year: number | null;
  same_university: boolean;
  same_department: boolean;
  same_class_year: boolean;
}

export interface CourseSocialSignalsV1 {
  course_id: string;
  window_days: number;
  generated_at: string;
  contributors: ContributorSignal[];
  featured_content: FeaturedContentSignal[];
}

const EMPTY_SIGNALS: CourseSocialSignalsV1 = {
  course_id: "",
  window_days: 30,
  generated_at: "",
  contributors: [],
  featured_content: [],
};

const asRecord = (value: Json): Record<string, Json> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, Json>;
};

const asString = (value: Json, fallback = ""): string => (typeof value === "string" ? value : fallback);
const asNullableString = (value: Json): string | null => (typeof value === "string" ? value : null);
const asNumber = (value: Json, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const asBoolean = (value: Json): boolean => value === true;

const toContributor = (value: Json): ContributorSignal | null => {
  const row = asRecord(value);
  if (!row) return null;

  const userId = asString(row.user_id);
  if (!userId) return null;

  return {
    user_id: userId,
    username: asString(row.username, "kullanici"),
    display_name: asString(row.display_name, "Kullanici"),
    avatar_url: asNullableString(row.avatar_url),
    university: asNullableString(row.university),
    department: asNullableString(row.department),
    class_year: typeof row.class_year === "number" ? row.class_year : null,
    posts_30d: asNumber(row.posts_30d),
    comments_30d: asNumber(row.comments_30d),
    chat_messages_30d: asNumber(row.chat_messages_30d),
    helpful_positive: asNumber(row.helpful_positive),
    post_comment_count_sum: asNumber(row.post_comment_count_sum),
    activity_score: asNumber(row.activity_score),
    quality_score: asNumber(row.quality_score),
    course_reputation_v1: asNumber(row.course_reputation_v1),
    same_university: asBoolean(row.same_university),
    same_department: asBoolean(row.same_department),
    same_class_year: asBoolean(row.same_class_year),
  };
};

const toFeatured = (value: Json): FeaturedContentSignal | null => {
  const row = asRecord(value);
  if (!row) return null;

  const postId = asString(row.post_id);
  const userId = asString(row.author_user_id);
  const contentType = asString(row.content_type);

  if (!postId || !userId) return null;
  if (!contentType || !["notes", "past_exams", "discussion", "kaynaklar"].includes(contentType)) return null;

  return {
    post_id: postId,
    title: asString(row.title, "İçerik"),
    content_type: contentType as FeaturedContentSignal["content_type"],
    created_at: asString(row.created_at),
    helpful_count: asNumber(row.helpful_count),
    comment_count: asNumber(row.comment_count),
    featured_v1: asNumber(row.featured_v1),
    author_user_id: userId,
    author_username: asString(row.author_username, "kullanici"),
    author_display_name: asString(row.author_display_name, "Kullanici"),
    author_avatar_url: asNullableString(row.author_avatar_url),
    author_university: asNullableString(row.author_university),
    author_department: asNullableString(row.author_department),
    author_class_year: typeof row.author_class_year === "number" ? row.author_class_year : null,
    same_university: asBoolean(row.same_university),
    same_department: asBoolean(row.same_department),
    same_class_year: asBoolean(row.same_class_year),
  };
};

const parseSignals = (value: Json, courseId: string): CourseSocialSignalsV1 => {
  const root = asRecord(value);
  if (!root) return { ...EMPTY_SIGNALS, course_id: courseId };

  const contributors = Array.isArray(root.contributors)
    ? root.contributors.map(toContributor).filter((item): item is ContributorSignal => item !== null)
    : [];

  const featuredContent = Array.isArray(root.featured_content)
    ? root.featured_content.map(toFeatured).filter((item): item is FeaturedContentSignal => item !== null)
    : [];

  return {
    course_id: asString(root.course_id, courseId),
    window_days: asNumber(root.window_days, 30),
    generated_at: asString(root.generated_at),
    contributors,
    featured_content: featuredContent,
  };
};

export function useCourseSocialSignalsV1(courseId?: string, viewerUserId?: string) {
  return useQuery({
    queryKey: ["course-social-signals-v1", courseId, viewerUserId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_course_social_signals_v1", {
        p_course_id: courseId!,
        p_viewer_user_id: viewerUserId ?? null,
        p_days: 30,
        p_limit: 5,
      });

      if (error) throw error;
      return parseSignals((data ?? null) as Json, courseId!);
    },
    enabled: !!courseId,
    staleTime: 60_000,
  });
}
