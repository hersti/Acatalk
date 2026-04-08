import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowRight, BookOpen, MessageCircle, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { ProductCard, ProductEmptyState, SectionHeader } from "@/components/ui/product";
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
    <ProductCard className="p-3">
      <SectionHeader title={title} description={description} icon={<BookOpen className="h-4 w-4" />} />

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Yükleniyor...</p>
      ) : items.length === 0 ? (
        <ProductEmptyState
          icon={<BookOpen className="h-5 w-5" />}
          title="Henüz içerik yok"
          description={emptyText}
          className="max-w-none p-5"
          actionNode={
            emptyActionLabel && emptyActionHref ? (
              <Link to={emptyActionHref} className="text-sm font-semibold text-primary hover:underline">
                {emptyActionLabel}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const code = normalizeCourseCode(item.code || "");
            const totalContent = item.notes_count + item.past_exams_count + item.discussion_count + item.kaynaklar_count;

            return (
              <article key={item.course_id} className="rounded-xl border border-border/70 bg-card px-3 py-3 transition-all hover:border-primary/35 hover:bg-secondary/35">
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

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
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
    </ProductCard>
  );
}
