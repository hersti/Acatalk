import { Link } from "react-router-dom";
import { Award, MessageCircle, RefreshCcw, Sparkles, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import type { CourseSocialSignalsV1 } from "@/hooks/useCourseSocialSignalsV1";

interface CourseActiveContributorsCardProps {
  contributors: CourseSocialSignalsV1["contributors"];
  loading: boolean;
  hasError: boolean;
  onRetry: () => void;
}

const formatScore = (value: number) => value.toFixed(1);

export default function CourseActiveContributorsCard({
  contributors,
  loading,
  hasError,
  onRetry,
}: CourseActiveContributorsCardProps) {
  return (
    <Surface variant="base" border="subtle" padding="sm" radius="lg">
      <h3 className="mb-2 flex items-center gap-1.5 font-heading text-xs font-bold">
        <Users className="h-3.5 w-3.5 text-primary" />
        Aktif Katkıcılar
      </h3>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Ders katkıcıları yükleniyor...</p>
      ) : hasError ? (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">Katkı sinyalleri şu an alınamıyor.</p>
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={onRetry}>
            <RefreshCcw className="h-3 w-3" />
            Tekrar Dene
          </Button>
        </div>
      ) : contributors.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Bu derste henüz öne çıkan katkı yok. İlk not, tartışma veya sohbet mesajı ile alan canlanır.
        </p>
      ) : (
        <div className="space-y-1.5">
          {contributors.map((contributor, index) => {
            const displayName = contributor.display_name || contributor.username || "Kullanıcı";
            const firstLetter = (displayName[0] || "K").toUpperCase();
            const username = contributor.username || "kullanici";

            return (
              <div key={contributor.user_id} className="rounded-md border border-border/60 bg-secondary/20 px-2 py-2">
                <div className="flex items-start gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    {contributor.avatar_url ? <AvatarImage src={contributor.avatar_url} alt={displayName} /> : null}
                    <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{firstLetter}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Link to={`/user/${contributor.user_id}`} className="truncate text-[11px] font-semibold transition-colors hover:text-primary">
                        {displayName}
                      </Link>
                      <span className="text-[9px] text-muted-foreground">#{index + 1}</span>
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">@{username}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Award className="h-2.5 w-2.5" /> {formatScore(contributor.course_reputation_v1)}
                      </span>
                      <span>{contributor.posts_30d + contributor.comments_30d} katkı</span>
                      {contributor.chat_messages_30d > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle className="h-2.5 w-2.5" /> {contributor.chat_messages_30d}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1">
                  {contributor.same_university ? (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">Aynı üniversite</span>
                  ) : null}
                  {contributor.same_department ? (
                    <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">Aynı bölüm</span>
                  ) : null}
                  {contributor.class_year ? (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                      {contributor.class_year}. sınıf
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}

          <p className="flex items-center gap-1 pt-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-2.5 w-2.5" />
            Sıralama, son 30 gün aktivite ve kalite sinyallerine göre hesaplanır.
          </p>
        </div>
      )}
    </Surface>
  );
}
