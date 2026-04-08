import type { Database } from "@/integrations/supabase/types";

type ContentType = Database["public"]["Enums"]["content_type"];

export const COURSE_NAV_TABS = ["overview", "notes", "past_exams", "discussion", "kaynaklar", "chat"] as const;

export type CourseNavigationTab = (typeof COURSE_NAV_TABS)[number];

const COURSE_TAB_SET = new Set<string>(COURSE_NAV_TABS);

export function isCourseNavigationTab(value: string | null | undefined): value is CourseNavigationTab {
  return !!value && COURSE_TAB_SET.has(value);
}

export function resolveCourseTabFromContentType(contentType?: ContentType | null): CourseNavigationTab {
  if (!contentType) return "overview";
  if (contentType === "notes") return "notes";
  if (contentType === "past_exams") return "past_exams";
  if (contentType === "discussion") return "discussion";
  return "kaynaklar";
}

export function buildCourseHubHref(courseId: string, tab: CourseNavigationTab = "overview"): string {
  if (!courseId) return "/courses";
  if (tab === "overview") return `/course/${courseId}`;

  const params = new URLSearchParams();
  params.set("tab", tab);
  return `/course/${courseId}?${params.toString()}`;
}

export function buildPostDetailHref(postId: string, options?: { courseId?: string | null; tab?: CourseNavigationTab | null }): string {
  if (!postId) return "/";
  const params = new URLSearchParams();

  if (options?.courseId) params.set("courseId", options.courseId);
  if (options?.tab && options.tab !== "overview") params.set("tab", options.tab);

  const query = params.toString();
  return query ? `/post/${postId}?${query}` : `/post/${postId}`;
}