export const normalizeCourseCode = (code: string | null | undefined): string =>
  String(code ?? "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .trim();

export const normalizeCourseCodeOrNull = (code: string | null | undefined): string | null => {
  const normalized = normalizeCourseCode(code);
  return normalized.length > 0 ? normalized : null;
};

export const buildCourseSelectLabel = (course: {
  name: string;
  code?: string | null;
  year?: number | null;
}): string => {
  const normalizedCode = normalizeCourseCode(course.code);
  const yearLabel =
    typeof course.year === "number"
      ? course.year === 0
        ? "Hazırlık"
        : `${course.year}. Sınıf`
      : null;

  return `${normalizedCode ? `${normalizedCode} - ` : ""}${course.name}${yearLabel ? ` (${yearLabel})` : ""}`;
};
