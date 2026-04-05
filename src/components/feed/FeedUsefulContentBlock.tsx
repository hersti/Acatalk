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
  past_exams: "Cikmis",
  discussion: "Tartisma",
  kaynaklar: "Kaynak",
};

export default function FeedUsefulContentBlock({ items, loading }: FeedUsefulContentBlockProps) {
  return (
    <Card className="p-4 border shadow-sm">
      <div className="mb-3">
        <h3 className="font-heading text-sm font-bold">Yeni Faydali Icerikler</h3>
        <p className="text-xs text-muted-foreground mt-1">Fayda sinyali yuksek, ders baglami belirgin son icerikler.</p>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Icerik onerileri yukleniyor...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Bu aralikta one cikan icerik yok. Hareketli dersleri ziyaret ederek guncel icerikleri gorebilirsin.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const authorName = item.author_display_name || item.author_username || "Kullanici";
            const firstLetter = (authorName[0] || "K").toUpperCase();
            const courseCode = normalizeCourseCode(item.course_code || "");
            return (
              <div key={item.post_id} className="rounded-lg border border-border/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {typeLabels[item.content_type]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}
                  </span>
                </div>

                <p className="mt-1 text-sm font-medium line-clamp-2">{item.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                  {[courseCode, item.course_name].filter(Boolean).join(" · ")}
                </p>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <Link to={`/user/${item.author_user_id}`} className="inline-flex items-center gap-1.5 min-w-0 hover:text-primary transition-colors">
                    <Avatar className="h-5 w-5">
                      {item.author_avatar_url ? <AvatarImage src={item.author_avatar_url} alt={authorName} /> : null}
                      <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">{firstLetter}</AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] font-medium truncate">{authorName}</span>
                  </Link>

                  <div className="text-[10px] text-muted-foreground">
                    +{Math.max(0, item.helpful_count)} faydali · {item.comment_count} yorum
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <Link to={`/course/${item.course_id}`} className="text-[11px] font-semibold text-primary hover:underline">
                    Derse Git
                  </Link>
                  <span className="text-[10px] text-muted-foreground">|</span>
                  <Link to={`/post/${item.post_id}`} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
                    Icerigi Ac
                  </Link>
                  {item.same_university ? (
                    <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">Ayni uni</span>
                  ) : null}
                  {!item.same_university && item.same_department ? (
                    <span className="ml-auto rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">Ayni bolum</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
