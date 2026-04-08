import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowRight, MessageSquare, ThumbsUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProductCard, ProductEmptyState, SectionHeader } from "@/components/ui/product";
import type { FeedUsefulPostItem } from "@/hooks/useFeedSnapshotV1";
import { normalizeCourseCode } from "@/lib/course-code";

interface FeedUsefulContentBlockProps {
  items: FeedUsefulPostItem[];
  loading?: boolean;
}

const typeLabels: Record<FeedUsefulPostItem["content_type"], string> = {
  notes: "Not",
  past_exams: "Çıkmış",
  discussion: "Tartışma",
  kaynaklar: "Kaynak",
};

export default function FeedUsefulContentBlock({ items, loading }: FeedUsefulContentBlockProps) {
  const navigate = useNavigate();

  return (
    <ProductCard className="p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <SectionHeader title="Öne Çıkan İçerikler" description="Son günlerde en çok fayda üreten katkılar ve bağlamları." icon={<MessageSquare className="h-4 w-4" />} />
        <Link to="/courses" className="shrink-0 text-[11px] font-semibold text-primary hover:underline">
          Derslere Git
        </Link>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">İçerikler yükleniyor...</p>
      ) : items.length === 0 ? (
        <ProductEmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="Şu an öne çıkan içerik yok"
          description="Derslere gidip ilk katkıları başlatabilirsin."
          className="max-w-none p-5"
        />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const authorName = item.author_display_name || item.author_username || "Kullanıcı";
            const firstLetter = (authorName[0] || "K").toUpperCase();
            const courseCode = normalizeCourseCode(item.course_code || "");

            return (
              <article
                key={item.post_id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/post/${item.post_id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/post/${item.post_id}`);
                  }
                }}
                className="cursor-pointer rounded-xl border border-border/70 bg-card px-3 py-2.5 transition-all hover:border-primary/35 hover:bg-secondary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{typeLabels[item.content_type]}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {[courseCode, item.course_name].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}</span>
                </div>

                <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed">{item.title}</p>

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <Link
                    to={`/user/${item.author_user_id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-primary"
                  >
                    <Avatar className="h-5 w-5">
                      {item.author_avatar_url ? <AvatarImage src={item.author_avatar_url} alt={authorName} /> : null}
                      <AvatarFallback className="bg-primary/10 text-[9px] font-bold text-primary">{firstLetter}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-[11px] font-medium">{authorName}</span>
                  </Link>

                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> {Math.max(0, item.helpful_count)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {item.comment_count}
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                  <Link
                    to={`/course/${item.course_id}`}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                  >
                    Course Hub’a Git <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">İçeriği Aç</span>
                </div>

                {item.same_university || item.same_department ? (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {item.same_university ? "Aynı üniversite bağlamı" : "Aynı bölüm bağlamı"}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </ProductCard>
  );
}
