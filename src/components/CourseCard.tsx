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
        className="group h-full cursor-pointer overflow-hidden transition-colors duration-200 hover:border-primary/30"
        variant="raised"
        border="default"
        padding="none"
        radius="xl"
      >
        <div className="p-3">
          <div className="mb-1.5 flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex items-center gap-1.5">
                {normalizedCode && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{normalizedCode}</span>
                )}
                {(course as any).year !== null && (course as any).year !== undefined && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {(course as any).year === 0 ? "Hazırlık" : `${(course as any).year}. Sınıf`}
                  </span>
                )}
              </div>
              <h3 className="line-clamp-2 font-heading text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
                {course.name}
              </h3>
              <AcademicMeta
                size="sm"
                tone="muted"
                wrap={false}
                className="mt-1"
                items={[
                  ...(course.department ? [{ kind: "department" as const, label: "Bölüm", value: course.department, emphasis: "subtle" as const }] : []),
                  ...(yearLabel ? [{ kind: "semester" as const, label: "Sınıf", value: yearLabel, emphasis: "subtle" as const }] : []),
                ]}
              />
            </div>
            <ArrowRight className="ml-2 mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-border pt-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.notes}</span> not
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.past_exams}</span> çıkmış
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.discussion}</span> tartışma
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <BookMarked className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.kaynaklar}</span> kaynak
            </div>
          </div>
        </div>
      </Surface>
    </Link>
  );
}

