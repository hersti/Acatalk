import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { BookMarked, MessageSquare, RefreshCcw, Sparkles, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CourseSocialSignalsV1 } from "@/hooks/useCourseSocialSignalsV1";

interface CourseFeaturedContentCardProps {
  featuredContent: CourseSocialSignalsV1["featured_content"];
  loading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

const typeLabels: Record<CourseSocialSignalsV1["featured_content"][number]["content_type"], string> = {
  notes: "Not",
  past_exams: "Cikmis",
  discussion: "Tartisma",
  kaynaklar: "Kaynak",
};

const typeClasses: Record<CourseSocialSignalsV1["featured_content"][number]["content_type"], string> = {
  notes: "bg-notes/10 text-notes",
  past_exams: "bg-primary/10 text-primary",
  discussion: "bg-accent/10 text-accent",
  kaynaklar: "bg-kaynaklar/10 text-kaynaklar",
};

export default function CourseFeaturedContentCard({
  featuredContent,
  loading,
  hasError,
  onRetry,
}: CourseFeaturedContentCardProps) {
  return (
    <Card className="p-3 border shadow-sm">
      <h3 className="font-heading text-xs font-bold flex items-center gap-1.5 mb-2">
        <BookMarked className="h-3.5 w-3.5 text-primary" />
        En Faydali Icerikler
      </h3>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Icerik sinyalleri yukleniyor...</p>
      ) : hasError ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Faydali icerikler su an listelenemiyor.</p>
          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={onRetry}>
            <RefreshCcw className="h-3 w-3" />
            Tekrar Dene
          </Button>
        </div>
      ) : featuredContent.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Bu ders icin one cikan icerik henuz yok. Ilk faydali katkilar geldikce bu liste olusur.
        </p>
      ) : (
        <div className="space-y-1.5">
          {featuredContent.map((item) => (
            <div key={item.post_id} className="rounded-md border border-border/60 bg-secondary/20 px-2 py-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold ${typeClasses[item.content_type]}`}>
                  {typeLabels[item.content_type]}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr }) : "Yeni"}
                </span>
              </div>

              <Link to={`/post/${item.post_id}`} className="mt-1 block text-[11px] font-medium leading-snug hover:text-primary transition-colors line-clamp-2">
                {item.title}
              </Link>

              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-2.5 w-2.5" /> {Math.max(0, item.helpful_count)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-2.5 w-2.5" /> {item.comment_count}
                </span>
                <span>Skor {item.featured_v1.toFixed(1)}</span>
              </div>

              <div className="mt-1 flex items-center justify-between gap-2">
                <Link to={`/user/${item.author_user_id}`} className="text-[10px] font-semibold hover:text-primary transition-colors truncate">
                  {item.author_display_name}
                </Link>
                <div className="flex items-center gap-1">
                  {item.same_university ? (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">Ayni uni</span>
                  ) : null}
                  {item.same_department ? (
                    <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">Ayni bolum</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          <p className="text-[10px] text-muted-foreground pt-1 flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            Liste helpful + yorum + guncellik sinyalleriyle uretilir.
          </p>
        </div>
      )}
    </Card>
  );
}
