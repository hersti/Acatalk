import type { Database } from "@/integrations/supabase/types";

export type AcademicContentType = Database["public"]["Enums"]["content_type"];

type ContentMeta = {
  label: string;
  singularLabel: string;
  shortLabel: string;
};

export const ACADEMIC_CONTENT_META: Record<AcademicContentType, ContentMeta> = {
  notes: {
    label: "Notlar",
    singularLabel: "Not",
    shortLabel: "not",
  },
  past_exams: {
    label: "Geçmiş Sınavlar",
    singularLabel: "Geçmiş Sınav",
    shortLabel: "sınav",
  },
  discussion: {
    label: "Tartışmalar",
    singularLabel: "Tartışma",
    shortLabel: "tartışma",
  },
  kaynaklar: {
    label: "Kaynaklar",
    singularLabel: "Kaynak",
    shortLabel: "kaynak",
  },
};

export function isAcademicContentType(value: string): value is AcademicContentType {
  return value in ACADEMIC_CONTENT_META;
}

export function getAcademicContentLabel(value: string, singular = false): string {
  if (!isAcademicContentType(value)) return "İçerik";
  return singular ? ACADEMIC_CONTENT_META[value].singularLabel : ACADEMIC_CONTENT_META[value].label;
}
