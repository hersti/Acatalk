import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
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
  return (
    <Card className="rounded-xl border border-border/80 bg-card shadow-sm p-2.5">
      <div className="mb-1.5">
        <h3 className="font-heading text-sm font-bold leading-tight">Öne Çıkan İçerikler</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Son günlerde en çok fayda üreten içerikler.</p>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">İçerikler yükleniyor...</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/70 px-2 py-1.5">
          <p className="text-[11px] text-muted-foreground">Şu an öne çıkan içerik yok.</p>
          <Link to="/#courses-grid" className="mt-1 inline-block text-[11px] font-semibold text-primary hover:underline">
            Dersleri incele
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const authorName = item.author_display_name || item.author_username || "Kullanıcı";
            const firstLetter = (authorName[0] || "K").toUpperCase();
            const courseCode = normalizeCourseCode(item.course_code || "");
            return (
              <div key={item.post_id} className="rounded-lg border border-border/70 px-2 py-1.5 hover:border-primary/30 hover:bg-secondary/30 hover-lift transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {typeLabels[item.content_type]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}
                  </span>
                </div>

                <p className="mt-1 text-[12px] font-medium line-clamp-2">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                  {[courseCode, item.course_name].filter(Boolean).join(" · ")}
                </p>

                <div className="mt-1 flex items-center justify-between gap-2">
                  <Link to={`/user/${item.author_user_id}`} className="inline-flex items-center gap-1.5 min-w-0 hover:text-primary transition-colors">
                    <Avatar className="h-5 w-5">
                      {item.author_avatar_url ? <AvatarImage src={item.author_avatar_url} alt={authorName} /> : null}
                      <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{firstLetter}</AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] font-medium truncate">{authorName}</span>
                  </Link>

                  <div className="text-[10px] text-muted-foreground">
                    +{Math.max(0, item.helpful_count)} · {item.comment_count} yorum
                  </div>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                  <Link to={`/course/${item.course_id}`} className="font-semibold text-primary hover:underline">
                    Derse git
                  </Link>
                  <span className="text-muted-foreground">|</span>
                  <Link to={`/post/${item.post_id}`} className="text-muted-foreground hover:text-foreground hover:underline">
                    İçeriği aç
                  </Link>
                </div>

                {item.same_university || item.same_department ? (
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {item.same_university ? "Aynı üniversite" : "Aynı bölüm"}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
