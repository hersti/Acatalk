export interface LocalCourseVisit {
  courseId: string;
  lastVisitedAt: string;
  visitCount: number;
  lastSource: string;
}

const STORAGE_KEY = "feed-v1-course-visits";

const parse = (raw: string | null): LocalCourseVisit[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const record = item as Record<string, unknown>;
        const courseId = typeof record.courseId === "string" ? record.courseId : "";
        const lastVisitedAt = typeof record.lastVisitedAt === "string" ? record.lastVisitedAt : "";
        const visitCount = typeof record.visitCount === "number" && record.visitCount > 0 ? record.visitCount : 1;
        const lastSource = typeof record.lastSource === "string" ? record.lastSource : "course";
        if (!courseId || !lastVisitedAt) return null;
        return { courseId, lastVisitedAt, visitCount, lastSource };
      })
      .filter((item): item is LocalCourseVisit => item !== null)
      .sort((a, b) => new Date(b.lastVisitedAt).getTime() - new Date(a.lastVisitedAt).getTime());
  } catch {
    return [];
  }
};

const persist = (visits: LocalCourseVisit[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visits.slice(0, 20)));
  } catch {
    // Storage failures should never break UX.
  }
};

export const getRecentCourseVisitsLocal = (limit = 8): LocalCourseVisit[] => {
  const visits = parse(localStorage.getItem(STORAGE_KEY));
  return visits.slice(0, Math.max(1, limit));
};

export const recordCourseVisitLocal = (courseId: string, source = "course") => {
  if (!courseId) return;

  const now = new Date().toISOString();
  const existing = parse(localStorage.getItem(STORAGE_KEY));
  const byId = new Map(existing.map((visit) => [visit.courseId, visit]));
  const current = byId.get(courseId);

  byId.set(courseId, {
    courseId,
    lastVisitedAt: now,
    visitCount: (current?.visitCount || 0) + 1,
    lastSource: source || current?.lastSource || "course",
  });

  persist(Array.from(byId.values()));
};
