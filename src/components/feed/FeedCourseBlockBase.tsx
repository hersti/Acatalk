import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { BookOpen, MessageCircle, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
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
    <Card className="rounded-xl border border-border/80 bg-card shadow-sm p-2.5">
      <div className="mb-1.5">
        <h3 className="font-heading text-sm font-bold leading-tight">{title}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Yükleniyor...</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 px-2 py-1.5">
          <p className="text-[11px] text-muted-foreground">{emptyText}</p>
          {emptyActionLabel && emptyActionHref ? (
            <Link to={emptyActionHref} className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline">
              {emptyActionLabel}
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const code = normalizeCourseCode(item.code || "");
            const totalContent = item.notes_count + item.past_exams_count + item.discussion_count + item.kaynaklar_count;
            return (
              <Link
                key={item.course_id}
                to={`/course/${item.course_id}`}
                className="block rounded-lg border border-border/70 px-2 py-1.5 transition-colors hover:border-primary/30 hover:bg-secondary/30 hover-lift"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {[code, item.department].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
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
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
