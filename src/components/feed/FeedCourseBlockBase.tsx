import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowRight, BookOpen, MessageCircle, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Surface } from "@/components/ui/surface";
import type { FeedCourseBlockItem } from "@/hooks/useFeedSnapshotV1";
import { normalizeCourseCode } from "@/lib/course-code";

interface FeedCourseBlockBaseProps {
  title: string;
  description: string;
  emptyText: string;
  items: FeedCourseBlockItem[];
  loading?: boolean;
  emphasizeResume?: boolean;
  emptyActionLabel?: string;
  emptyActionHref?: string;
}

function LastActivityText({ item }: { item: FeedCourseBlockItem }) {
  const timestamp = item.last_visited_at || item.last_activity_at;
  if (!timestamp) return <span>Yakın zamanda hareket yok</span>;
  return <span>{formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr })}</span>;
}

export default function FeedCourseBlockBase({
  title,
  description,
  emptyText,
  items,
  loading = false,
  emphasizeResume = false,
  emptyActionLabel,
  emptyActionHref,
}: FeedCourseBlockBaseProps) {
  return (
    <Surface variant="base" border="subtle" padding="sm" radius="xl">
      <div className="mb-2">
        <h3 className="font-heading text-sm font-bold leading-tight">{title}</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Yükleniyor...</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 px-2.5 py-2">
          <p className="text-[11px] text-muted-foreground">{emptyText}</p>
          {emptyActionLabel && emptyActionHref ? (
            <Link to={emptyActionHref} className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline">
              {emptyActionLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const code = normalizeCourseCode(item.code || "");
            const totalContent = item.notes_count + item.past_exams_count + item.discussion_count + item.kaynaklar_count;

            return (
              <article key={item.course_id} className="rounded-lg border border-border/70 px-2.5 py-2 transition-colors hover:border-primary/35 hover:bg-secondary/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-[13px] font-semibold">{item.name}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">{[item.university, item.department].filter(Boolean).join(" · ")}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground/90">{[code, item.year ? `${item.year}. sınıf` : null].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Link to={`/course/${item.course_id}`} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                    Hub <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {totalContent} içerik
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {item.active_contributors_14d} katkıcı
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {item.chat_messages_7d} sohbet
                  </span>
                </div>

                <p className="mt-1 text-[10px] text-muted-foreground/90">
                  {emphasizeResume && item.visit_count ? `${item.visit_count} kez baktın · ` : ""}
                  Son hareket: <LastActivityText item={item} />
                </p>
              </article>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
