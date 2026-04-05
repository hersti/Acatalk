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
}

function LastActivityText({ item }: { item: FeedCourseBlockItem }) {
  const timestamp = item.last_visited_at || item.last_activity_at;
  if (!timestamp) return <span>Aktivite sinirli</span>;
  return <span>{formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: tr })}</span>;
}

export default function FeedCourseBlockBase({
  title,
  description,
  emptyText,
  items,
  loading = false,
  emphasizeResume = false,
}: FeedCourseBlockBaseProps) {
  return (
    <Card className="p-4 border shadow-sm">
      <div className="mb-3">
        <h3 className="font-heading text-sm font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Yukleniyor...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const code = normalizeCourseCode(item.code || "");
            const totalContent = item.notes_count + item.past_exams_count + item.discussion_count + item.kaynaklar_count;
            return (
              <Link
                key={item.course_id}
                to={`/course/${item.course_id}`}
                className="block rounded-lg border border-border/70 px-3 py-2 hover:border-primary/30 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {[code, item.department].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {emphasizeResume && item.visit_count ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {item.visit_count} ziyaret
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {totalContent} icerik
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {item.active_contributors_14d} katkici
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" /> {item.chat_messages_7d} sohbet
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
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
