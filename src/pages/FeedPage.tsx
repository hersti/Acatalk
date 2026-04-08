import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { BookOpen, Building2, Compass, Layers3, MessageCircle } from "lucide-react";

import Layout from "@/components/Layout";
import FeedRecommendedCoursesBlock from "@/components/feed/FeedRecommendedCoursesBlock";
import FeedActiveCoursesBlock from "@/components/feed/FeedActiveCoursesBlock";
import FeedResumeCoursesBlock from "@/components/feed/FeedResumeCoursesBlock";
import FeedUsefulContentBlock from "@/components/feed/FeedUsefulContentBlock";
import { useAuth } from "@/contexts/AuthContext";
import { useFeedSnapshotV1 } from "@/hooks/useFeedSnapshotV1";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-blocks";
import { AppPageHeader, HelperCard, HelperPanel, MetricCard, ProductCard } from "@/components/ui/product";

function MetricChip({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span>{label}:</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function FeedPage() {
  const { user } = useAuth();
  const { data: feedSnapshot, isLoading: feedLoading, isError: feedError } = useFeedSnapshotV1(user?.id, 8, 8, 30);

  const contextJumpCourses = useMemo(() => {
    const source = [
      ...(feedSnapshot?.resume_courses || []),
      ...(feedSnapshot?.active_courses || []),
      ...(feedSnapshot?.recommended_courses || []),
    ];

    const seen = new Set<string>();
    return source
      .filter((item) => {
        if (seen.has(item.course_id)) return false;
        seen.add(item.course_id);
        return true;
      })
      .slice(0, 4);
  }, [feedSnapshot?.active_courses, feedSnapshot?.recommended_courses, feedSnapshot?.resume_courses]);

  const lastGeneratedText = useMemo(() => {
    const generatedAt = feedSnapshot?.generated_at;
    if (!generatedAt) return "Henüz güncellenmedi";
    return formatDistanceToNow(new Date(generatedAt), { addSuffix: true, locale: tr });
  }, [feedSnapshot?.generated_at]);

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <AppPageHeader
          title="Ana Akış"
          description="Bağlamlı keşif, canlı sinyal ve doğal Course Hub geçişi için feed yüzeyi."
          icon={<Compass className="h-5 w-5" />}
          actions={
            <>
              <Button asChild size="sm" className="h-9 rounded-xl">
                <Link to="/courses">Dersleri Keşfet</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-9 rounded-xl">
                <Link to="/universities">Üniversiteler</Link>
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <ProductCard highlighted>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Feed Kompozisyonu</p>
              <h2 className="mt-1 font-heading text-2xl font-extrabold tracking-tight">Bağlamı bul, üretime geç, Course Hub’a dön</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Ana akış ders kataloğu değildir; hareketi gösterir, faydayı öne çıkarır ve seni doğru dersin Course Hub alanına taşır.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <MetricChip icon={BookOpen} label="Önerilen Ders" value={`${feedSnapshot?.recommended_courses.length || 0}`} />
                <MetricChip icon={MessageCircle} label="Faydalı İçerik" value={`${feedSnapshot?.useful_posts.length || 0}`} />
                <MetricChip icon={Compass} label="Güncelleme" value={lastGeneratedText} />
              </div>
            </ProductCard>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Önerilen" value={feedSnapshot?.recommended_courses.length || 0} icon={<BookOpen className="h-4 w-4" />} />
              <MetricCard label="Aktif Ders" value={feedSnapshot?.active_courses.length || 0} icon={<Layers3 className="h-4 w-4" />} />
              <MetricCard label="Faydalı İçerik" value={feedSnapshot?.useful_posts.length || 0} icon={<MessageCircle className="h-4 w-4" />} />
            </div>

            {feedError ? (
              <StateBlock
                variant="error"
                size="section"
                title="Akış verisi alınamadı"
                description="Keşif blokları geçici olarak yüklenemedi. Dersler ekranından devam edebilirsiniz."
                primaryAction={
                  <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                    <Link to="/courses">Derslere Git</Link>
                  </Button>
                }
              />
            ) : null}

            <FeedUsefulContentBlock items={(feedSnapshot?.useful_posts || []).slice(0, 4)} loading={feedLoading} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FeedRecommendedCoursesBlock items={(feedSnapshot?.recommended_courses || []).slice(0, 4)} loading={feedLoading} />
              <FeedActiveCoursesBlock items={(feedSnapshot?.active_courses || []).slice(0, 4)} loading={feedLoading} />
            </div>

            <FeedResumeCoursesBlock items={(feedSnapshot?.resume_courses || []).slice(0, 4)} loading={feedLoading} />
          </div>

          <HelperPanel className="hidden bg-gradient-to-b from-card to-card/95 lg:block">
            <HelperCard title="Akışın Rolü" icon={<Layers3 className="h-4 w-4" />} highlighted>
              <p className="text-xs text-muted-foreground">
                Burada amaç oyalanmak değil, doğru bağlamı bulup üretime geçmek. Nihai merkez her zaman Course Hub’dır.
              </p>
            </HelperCard>

            <HelperCard title="Hızlı Geçişler" icon={<Compass className="h-4 w-4" />}>
              {contextJumpCourses.length === 0 ? (
                <p className="text-xs text-muted-foreground">Henüz bağlamsal geçiş verisi yok. Derslere girince burada hızlı dönüşler görünür.</p>
              ) : (
                <div className="space-y-2">
                  {contextJumpCourses.map((item) => (
                    <Link key={item.course_id} to={`/course/${item.course_id}`}>
                      <ProductCard className="p-2.5 transition-colors hover:border-primary/35">
                        <p className="line-clamp-1 text-xs font-semibold">{item.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{item.department}</p>
                        <p className="mt-1 text-[11px] font-semibold text-primary">Course Hub’a Git</p>
                      </ProductCard>
                    </Link>
                  ))}
                </div>
              )}
            </HelperCard>

            <HelperCard title="Üst Bağlam" icon={<Building2 className="h-4 w-4" />} className="bg-gradient-to-b from-card to-secondary/20">
              <p className="text-xs text-muted-foreground">Üniversite ekosisteminden bölüm ve ders ilişkisine geçmek için üst bağlamı açık tut.</p>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" variant="outline" className="h-8 w-full rounded-lg">
                  <Link to="/universities">Üniversiteleri Aç</Link>
                </Button>
                <Button asChild size="sm" className="h-8 w-full rounded-lg">
                  <Link to="/courses">Derslere Geç</Link>
                </Button>
              </div>
            </HelperCard>
          </HelperPanel>

          <div className="space-y-3 lg:hidden">
            <ProductCard>
              <h2 className="font-heading text-sm font-bold">Bağlama Hızlı Geçiş</h2>
              <p className="mt-1 text-xs text-muted-foreground">Feed’ten sonra en hızlı yol: ders veya üniversite bağlamına geçiş.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="h-8 w-full rounded-lg">
                  <Link to="/courses">Dersler</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full rounded-lg">
                  <Link to="/universities">Üniversiteler</Link>
                </Button>
              </div>
            </ProductCard>
          </div>
        </div>
      </div>
    </Layout>
  );
}
