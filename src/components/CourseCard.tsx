import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Surface } from "@/components/ui/surface";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { FileText, MessageSquare, BookOpen, BookMarked, ArrowRight, Clock3, MessageCircle, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { normalizeCourseCode } from "@/lib/course-code";

interface CourseCardProps {
  course: Tables<"courses"> & { year?: number | null };
  postCounts?: { notes: number; past_exams: number; discussion: number; kaynaklar: number };
  signals?: {
    activeContributors: number;
    lastActivityAt: string | null;
    newContentCount: number;
    chatMessageCount: number;
  };
}

export default function CourseCard({ course, postCounts, signals }: CourseCardProps) {
  const counts = postCounts ?? { notes: 0, past_exams: 0, discussion: 0, kaynaklar: 0 };
  const normalizedCode = normalizeCourseCode(course.code);
  const classYear = course.year;
  const lastActivityLabel = signals?.lastActivityAt
    ? formatDistanceToNow(new Date(signals.lastActivityAt), { addSuffix: true, locale: tr })
    : "Henüz aktivite yok";

  return (
    <Link to={`/course/${course.id}`}>
      <Surface
        className="group h-full cursor-pointer overflow-hidden transition-colors duration-200 hover:border-primary/30"
        variant="raised"
        border="default"
        padding="none"
        radius="xl"
      >
        <div className="p-2.5">
          <div className="mb-1.5 flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5">
                {normalizedCode && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{normalizedCode}</span>
                )}
                {classYear !== null && classYear !== undefined && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {classYear === 0 ? "Hazırlık" : `${classYear}. Sınıf`}
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
                  ...(course.university
                    ? [
                        {
                          kind: "university" as const,
                          label: "Üniversite",
                          value: course.university,
                          emphasis: "subtle" as const,
                        },
                      ]
                    : []),
                  ...(course.department
                    ? [
                        {
                          kind: "department" as const,
                          label: "Bölüm",
                          value: course.department,
                          emphasis: "subtle" as const,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
            <ArrowRight className="ml-2 mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
          </div>

          <div className="mt-2.5 rounded-lg border border-border/60 bg-secondary/35 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock3 className="h-3 w-3" />
                <span>Son aktivite</span>
              </div>
              <span className="font-semibold text-foreground">{lastActivityLabel}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span className="font-medium text-foreground">{signals?.activeContributors || 0}</span> aktif katkı
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-background px-1.5 py-0.5 text-muted-foreground">
                <MessageCircle className="h-3 w-3" />
                <span className="font-medium text-foreground">{signals?.chatMessageCount || 0}</span> sohbet
              </span>
              {(signals?.newContentCount || 0) > 0 ? (
                <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                  +{signals?.newContentCount} yeni katkı
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-border/70 pt-2">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <FileText className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.notes}</span> not
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <BookOpen className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.past_exams}</span> geçmiş sınav
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.discussion}</span> tartışma
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <BookMarked className="h-3 w-3" />
              <span className="font-medium text-foreground">{counts.kaynaklar}</span> kaynak
            </div>
            <span className="ml-auto text-[11px] font-semibold text-primary">Course Hub'a Gir</span>
          </div>
        </div>
      </Surface>
    </Link>
  );
}
