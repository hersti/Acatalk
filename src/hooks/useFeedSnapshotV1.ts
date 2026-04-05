import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getRecentCourseVisitsLocal } from "@/lib/course-visits";

export interface FeedCourseBlockItem {
  course_id: string;
  name: string;
  code: string | null;
  department: string;
  university: string;
  year: number | null;
  notes_count: number;
  past_exams_count: number;
  discussion_count: number;
  kaynaklar_count: number;
  published_posts_14d: number;
  published_posts_30d?: number;
  helpful_sum_30d?: number;
  commented_posts_30d?: number;
  chat_messages_7d: number;
  active_contributors_14d: number;
  last_activity_at: string | null;
  fit_score?: number;
  activity_score?: number;
  quality_score?: number;
  resume_boost?: number;
  total_score?: number;
  last_visited_at?: string | null;
  visit_count?: number;
  last_source?: string | null;
}

export interface FeedUsefulPostItem {
  post_id: string;
  course_id: string;
  course_name: string;
  course_code: string | null;
  title: string;
  content_type: "notes" | "past_exams" | "discussion" | "kaynaklar";
  created_at: string;
  helpful_count: number;
  comment_count: number;
  featured_score: number;
  author_user_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  same_university: boolean;
  same_department: boolean;
}

export interface FeedSnapshotV1 {
  generated_at: string;
  recommended_courses: FeedCourseBlockItem[];
  resume_courses: FeedCourseBlockItem[];
  active_courses: FeedCourseBlockItem[];
  useful_posts: FeedUsefulPostItem[];
}

const EMPTY_SNAPSHOT: FeedSnapshotV1 = {
  generated_at: "",
  recommended_courses: [],
  resume_courses: [],
  active_courses: [],
  useful_posts: [],
};

const asRecord = (value: Json): Record<string, Json> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, Json>;
};

const asString = (value: Json, fallback = ""): string => (typeof value === "string" ? value : fallback);
const asNullableString = (value: Json): string | null => (typeof value === "string" ? value : null);
const asNumber = (value: Json, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const asBoolean = (value: Json): boolean => value === true;

const toFeedCourse = (value: Json): FeedCourseBlockItem | null => {
  const row = asRecord(value);
  if (!row) return null;

  const courseId = asString(row.course_id);
  if (!courseId) return null;

  return {
    course_id: courseId,
    name: asString(row.name, "Ders"),
    code: asNullableString(row.code),
    department: asString(row.department),
    university: asString(row.university),
    year: typeof row.year === "number" ? row.year : null,
    notes_count: asNumber(row.notes_count),
    past_exams_count: asNumber(row.past_exams_count),
    discussion_count: asNumber(row.discussion_count),
    kaynaklar_count: asNumber(row.kaynaklar_count),
    published_posts_14d: asNumber(row.published_posts_14d),
    published_posts_30d: asNumber(row.published_posts_30d),
    helpful_sum_30d: asNumber(row.helpful_sum_30d),
    commented_posts_30d: asNumber(row.commented_posts_30d),
    chat_messages_7d: asNumber(row.chat_messages_7d),
    active_contributors_14d: asNumber(row.active_contributors_14d),
    last_activity_at: asNullableString(row.last_activity_at),
    fit_score: asNumber(row.fit_score),
    activity_score: asNumber(row.activity_score),
    quality_score: asNumber(row.quality_score),
    resume_boost: asNumber(row.resume_boost),
    total_score: asNumber(row.total_score),
    last_visited_at: asNullableString(row.last_visited_at),
    visit_count: asNumber(row.visit_count),
    last_source: asNullableString(row.last_source),
  };
};

const toFeedPost = (value: Json): FeedUsefulPostItem | null => {
  const row = asRecord(value);
  if (!row) return null;

  const postId = asString(row.post_id);
  const courseId = asString(row.course_id);
  const contentType = asString(row.content_type);
  if (!postId || !courseId) return null;
  if (!contentType || !["notes", "past_exams", "discussion", "kaynaklar"].includes(contentType)) return null;

  return {
    post_id: postId,
    course_id: courseId,
    course_name: asString(row.course_name),
    course_code: asNullableString(row.course_code),
    title: asString(row.title, "Icerik"),
    content_type: contentType as FeedUsefulPostItem["content_type"],
    created_at: asString(row.created_at),
    helpful_count: asNumber(row.helpful_count),
    comment_count: asNumber(row.comment_count),
    featured_score: asNumber(row.featured_score),
    author_user_id: asString(row.author_user_id),
    author_username: asString(row.author_username, "kullanici"),
    author_display_name: asString(row.author_display_name, "Kullanici"),
    author_avatar_url: asNullableString(row.author_avatar_url),
    same_university: asBoolean(row.same_university),
    same_department: asBoolean(row.same_department),
  };
};

const parseSnapshot = (value: Json): FeedSnapshotV1 => {
  const root = asRecord(value);
  if (!root) return { ...EMPTY_SNAPSHOT };

  const recommended = Array.isArray(root.recommended_courses)
    ? root.recommended_courses.map(toFeedCourse).filter((item): item is FeedCourseBlockItem => item !== null)
    : [];

  const resume = Array.isArray(root.resume_courses)
    ? root.resume_courses.map(toFeedCourse).filter((item): item is FeedCourseBlockItem => item !== null)
    : [];

  const active = Array.isArray(root.active_courses)
    ? root.active_courses.map(toFeedCourse).filter((item): item is FeedCourseBlockItem => item !== null)
    : [];

  const usefulPosts = Array.isArray(root.useful_posts)
    ? root.useful_posts.map(toFeedPost).filter((item): item is FeedUsefulPostItem => item !== null)
    : [];

  return {
    generated_at: asString(root.generated_at),
    recommended_courses: recommended,
    resume_courses: resume,
    active_courses: active,
    useful_posts: usefulPosts,
  };
};

const buildLocalResumeFallback = async (limitCourses: number): Promise<FeedCourseBlockItem[]> => {
  const localVisits = getRecentCourseVisitsLocal(limitCourses);
  if (localVisits.length === 0) return [];

  const courseIds = localVisits.map((visit) => visit.courseId);
  const { data: courses } = await supabase
    .from("courses")
    .select("id, name, code, department, university, year")
    .in("id", courseIds);

  if (!courses || courses.length === 0) return [];

  const { data: posts } = await supabase
    .from("posts")
    .select("course_id, content_type")
    .eq("status", "published")
    .in("course_id", courseIds);

  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const visitMap = new Map(localVisits.map((visit) => [visit.courseId, visit]));

  const countMap = new Map<string, { notes: number; past_exams: number; discussion: number; kaynaklar: number }>();
  for (const post of posts || []) {
    const counts = countMap.get(post.course_id) || { notes: 0, past_exams: 0, discussion: 0, kaynaklar: 0 };
    if (post.content_type in counts) {
      counts[post.content_type as keyof typeof counts] += 1;
    }
    countMap.set(post.course_id, counts);
  }

  return localVisits
    .map((visit) => {
      const course = courseMap.get(visit.courseId);
      if (!course) return null;
      const counts = countMap.get(course.id) || { notes: 0, past_exams: 0, discussion: 0, kaynaklar: 0 };
      return {
        course_id: course.id,
        name: course.name,
        code: course.code,
        department: course.department,
        university: course.university,
        year: course.year,
        notes_count: counts.notes,
        past_exams_count: counts.past_exams,
        discussion_count: counts.discussion,
        kaynaklar_count: counts.kaynaklar,
        published_posts_14d: 0,
        chat_messages_7d: 0,
        active_contributors_14d: 0,
        last_activity_at: null,
        last_visited_at: visit.lastVisitedAt,
        visit_count: visit.visitCount,
        last_source: `${visit.lastSource}-local`,
      } as FeedCourseBlockItem;
    })
    .filter((item): item is FeedCourseBlockItem => item !== null);
};

const isMissingFunctionError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const row = error as Record<string, unknown>;
  const code = typeof row.code === "string" ? row.code : "";
  return code === "42883" || code === "42P01";
};

export function useFeedSnapshotV1(userId?: string, limitCourses = 8, limitPosts = 8, days = 30) {
  return useQuery({
    queryKey: ["feed-snapshot-v1", userId, limitCourses, limitPosts, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_feed_snapshot_v1", {
        p_limit_courses: limitCourses,
        p_limit_posts: limitPosts,
        p_days: days,
      });

      if (error && !isMissingFunctionError(error)) throw error;

      const snapshot = data ? parseSnapshot(data as Json) : { ...EMPTY_SNAPSHOT };

      if (snapshot.resume_courses.length === 0) {
        snapshot.resume_courses = await buildLocalResumeFallback(limitCourses);
      }

      return snapshot;
    },
    staleTime: 60_000,
  });
}
