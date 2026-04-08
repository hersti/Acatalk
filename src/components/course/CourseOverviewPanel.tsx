import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { BookMarked, BookOpen, ClipboardList, MessageCircle, MessageSquare, TrendingUp } from "lucide-react";

import type { Tables } from "@/integrations/supabase/types";
import type { CourseSocialSignalsV1 } from "@/hooks/useCourseSocialSignalsV1";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { StateBlock } from "@/components/ui/state-blocks";
import { ProductCard } from "@/components/ui/product";
import { buildPostDetailHref, resolveCourseTabFromContentType } from "@/lib/course-navigation";

type CourseSection = "notes" | "past_exams" | "discussion" | "kaynaklar" | "chat";

type OverviewPost = Pick<
  Tables<"posts">,
  "id" | "title" | "content_type" | "created_at" | "helpful_count" | "comment_count"
>;

type CourseOverviewPanelProps = {
  course: Tables<"courses">;
  canAddContent: boolean;
  tabCounts: {
    notes: number;
    past_exams: number;
    discussion: number;
    kaynaklar: number;
  };
  recentPosts: OverviewPost[];
  socialSignals?: CourseSocialSignalsV1;
  onSelectSection: (section: CourseSection) => void;
};

const SECTION_META: Array<{
  key: Exclude<CourseSection, "chat">;
  label: string;
  helper: string;
  icon: typeof BookOpen;
}> = [
  {
    key: "notes",
    label: "Notlar",
    helper: "Ders özetleri, formül setleri ve ders notları",
    icon: BookOpen,
  },
  {
    key: "past_exams",
    label: "Geçmiş Sınavlar",
    helper: "Vize, final ve quiz arşivi",
    icon: ClipboardList,
  },
  {
    key: "discussion",
    label: "Tartışmalar",
    helper: "Kalıcı soru-cevap ve akademik başlıklar",
    icon: MessageSquare,
  },
  {
    key: "kaynaklar",
    label: "Kaynaklar",
    helper: "Kitap, makale ve yardımcı dış kaynaklar",
    icon: BookMarked,
  },
];

export default function CourseOverviewPanel({
  course,
  canAddContent,
  tabCounts,
  recentPosts,
  socialSignals,
  onSelectSection,
}: CourseOverviewPanelProps) {
  const topContributors = socialSignals?.contributors.slice(0, 5) || [];

  return (
    <div className="space-y-3">
      <Surface variant="soft" border="subtle" radius="xl" padding="md">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Genel Bakış</p>
        <h2 className="mt-1 font-heading text-lg font-extrabold tracking-tight">{course.name}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Bu panel dersi tek bakışta anlamak ve doğru bölüme hızlı geçiş yapmak için tasarlanmıştır.
        </p>
      </Surface>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SECTION_META.map((section) => {
          const Icon = section.icon;
          return (
            <ProductCard key={section.key} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{section.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{section.helper}</p>
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Toplam</span>
                <span className="text-base font-extrabold text-primary">{tabCounts[section.key]}</span>
              </div>
              <Button size="sm" variant="outline" className="mt-2 h-8 w-full" onClick={() => onSelectSection(section.key)}>
                {section.label} Bölümüne Git
              </Button>
            </ProductCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
        <ProductCard className="p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Son Akademik Aktivite</p>
          </div>
          {recentPosts.length === 0 ? (
            <StateBlock
              variant="empty"
              size="inline"
              title="Henüz içerik hareketi yok"
              description="İlk notu veya tartışmayı başlatarak ders akışının oluşmasına katkı verebilirsin."
              primaryAction={
                canAddContent ? (
                  <Button size="sm" onClick={() => onSelectSection("notes")}>İlk Katkıyı Başlat</Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-1.5">
              {recentPosts.slice(0, 4).map((post) => (
                <Link
                  key={post.id}
                  to={buildPostDetailHref(post.id, {
                    courseId: course.id,
                    tab: resolveCourseTabFromContentType(post.content_type),
                  })}
                >
                  <Surface variant="soft" border="subtle" radius="lg" padding="sm" className="transition-colors hover:border-primary/30">
                    <p className="line-clamp-1 text-sm font-medium">{post.title || "Başlıksız içerik"}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })} · {post.helpful_count || 0} yararlı oy · {post.comment_count || 0} yorum
                    </p>
                  </Surface>
                </Link>
              ))}
            </div>
          )}
        </ProductCard>

        <ProductCard className="p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Aktif Katkicilar</p>
          </div>
          {topContributors.length === 0 ? (
            <StateBlock
              variant="empty"
              size="inline"
              title="Katkı sinyali henüz oluşmadı"
              description="Ders aktivitesi arttıkça yardımcı katkı yapan öğrenciler burada görünür."
            />
          ) : (
            <div className="space-y-1.5">
              {topContributors.map((contributor) => (
                <Surface key={contributor.user_id} variant="soft" border="subtle" radius="lg" padding="sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{contributor.display_name}</p>
                    <span className="text-xs font-semibold text-primary">{contributor.course_reputation_v1} katkı</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {contributor.posts_30d} gönderi · {contributor.comments_30d} yorum · {contributor.chat_messages_30d} sohbet
                  </p>
                </Surface>
              ))}
            </div>
          )}
        </ProductCard>
      </div>

      <ProductCard className="p-3">
        <p className="text-sm font-semibold">Yaklaşan Kritik Tarihler</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Bu ders için resmi deadline/sınav takvimi verisi bağlanmadığı sürece bu panel boş kalır.
        </p>
        <div className="mt-2 rounded-lg border border-dashed border-border/70 bg-secondary/35 p-2 text-[11px] text-muted-foreground">
          Veri bağlandığında quiz, ödev ve sınav tarihleri burada listelenecek.
        </div>
      </ProductCard>
    </div>
  );
}
