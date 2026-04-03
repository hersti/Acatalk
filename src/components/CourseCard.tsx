import { Link } from "react-router-dom";
import { Surface } from "@/components/ui/surface";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { FileText, MessageSquare, BookOpen, BookMarked, ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { normalizeCourseCode } from "@/lib/course-code";

interface CourseCardProps {
  course: Tables<"courses"> & { year?: number | null };
  postCounts?: { notes: number; past_exams: number; discussion: number; kaynaklar: number };
}

export default function CourseCard({ course, postCounts }: CourseCardProps) {
  const counts = postCounts ?? { notes: 0, past_exams: 0, discussion: 0, kaynaklar: 0 };
  const normalizedCode = normalizeCourseCode(course.code);
  const yearLabel =
    (course as any).year === null || (course as any).year === undefined
      ? undefined
      : (course as any).year === 0
        ? "Hazırlık"
        : `${(course as any).year}. Sınıf`;

  return (
    <Link to={`/course/${course.id}`}>
      <Surface
        className="group overflow-hidden hover:border-primary/30 transition-all duration-200 cursor-pointer h-full hover-lift"
        variant="raised"
        border="default"
        padding="none"
        radius="xl"
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {normalizedCode && (
                  <span className="text-[10px] font-semibold tracking-wide uppercase text-primary">{normalizedCode}</span>
                )}
                {(course as any).year !== null && (course as any).year !== undefined && (
                  <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {(course as any).year === 0 ? "Hazırlık" : `${(course as any).year}. Sınıf`}
                  </span>
                )}
              </div>
                <h3 className="font-heading text-sm font-bold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                {course.name}
              </h3>
              <AcademicMeta
                size="sm"
                tone="muted"
                className="mt-1"
                items={[
                  ...(course.department ? [{ kind: "department" as const, label: "Bölüm", value: course.department, emphasis: "subtle" as const }] : []),
                  ...(yearLabel ? [{ kind: "semester" as const, label: "Sınıf", value: yearLabel, emphasis: "subtle" as const }] : []),
                ]}
              />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 ml-3 mt-1" />
          </div>

          <div className="flex items-center gap-3 pt-3 mt-2 border-t border-border flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.notes}</span> not
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.past_exams}</span> çıkmış
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.discussion}</span> tartışma
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BookMarked className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.kaynaklar}</span> kaynak
            </div>
          </div>
        </div>
      </Surface>
    </Link>
  );
}
