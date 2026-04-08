import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Bell,
  BookOpen,
  Building2,
  Compass,
  MessageCircle,
  Pin,
  Plus,
  Share2,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react";

import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useFeedSnapshotV1 } from "@/hooks/useFeedSnapshotV1";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StateBlock } from "@/components/ui/state-blocks";
import {
  AppPageHeader,
  ContextChip,
  HelperCard,
  HelperPanel,
  PageMetricsRow,
  PageTabsBar,
  ProductCard,
  ProductEmptyState,
} from "@/components/ui/product";
import { getAcademicContentLabel, isAcademicContentType } from "@/lib/academic-content";


type FeedTab = "senin_icin" | "derslerim" | "takip_edilenler";
type PostRow = Pick<
  Tables<"posts">,
  "id" | "title" | "content" | "content_type" | "created_at" | "helpful_count" | "comment_count" | "course_id" | "user_id"
>;
type ProfileRow = Pick<Tables<"profiles">, "user_id" | "username" | "display_name" | "avatar_url" | "university">;
type CourseRow = Pick<Tables<"courses">, "id" | "name" | "code" | "university">;

type FeedTimelineItem = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  helpfulCount: number;
  commentCount: number;
  contentType: Tables<"posts">["content_type"];
  courseId: string;
  courseName: string;
  courseCode: string | null;
  courseUniversity: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string | null;
  sameUniversity: boolean;
  authorUserId: string;
};

function isFeedTab(value: string): value is FeedTab {
  return value === "senin_icin" || value === "derslerim" || value === "takip_edilenler";
}

function normalizePostContent(raw: string | null | undefined) {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}

export default function FeedPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FeedTab>("senin_icin");
  const [timelinePosts, setTimelinePosts] = useState<FeedTimelineItem[]>([]);
  const [profileUniversity, setProfileUniversity] = useState<string | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [timelineLoading, setTimelineLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const { data: feedSnapshot, isLoading: feedLoading, isError: feedError } = useFeedSnapshotV1(user?.id, 8, 8, 30);

  useEffect(() => {
    if (!user?.id) {
      setProfileUniversity(null);
      return;
    }

    supabase
      .from("profiles")
      .select("university")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileUniversity(data?.university || null);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setFollowingIds(new Set());
      return;
    }

    let cancelled = false;

    const loadFollowings = async () => {
      setFollowingLoading(true);
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
      if (!cancelled) {
        setFollowingIds(new Set((data || []).map((row) => row.following_id)));
        setFollowingLoading(false);
      }
    };

    void loadFollowings();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadTimelinePosts = async () => {
      setTimelineLoading(true);
      setTimelineError(null);
      try {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select("id,title,content,content_type,created_at,helpful_count,comment_count,course_id,user_id")
          .filter("status", "eq", "published")
          .in("content_type", ["notes", "past_exams", "discussion", "kaynaklar"])
          .order("created_at", { ascending: false })
          .limit(40);

        if (postsError) throw postsError;
        const rows: PostRow[] = postsData || [];

        if (rows.length === 0) {
          if (!cancelled) {
            setTimelinePosts([]);
            setTimelineLoading(false);
          }
          return;
        }

        const userIds = [...new Set(rows.map((row) => row.user_id))];
        const courseIds = [...new Set(rows.map((row) => row.course_id))];

        const [{ data: profilesData }, { data: coursesData }] = await Promise.all([
          supabase.from("profiles").select("user_id,username,display_name,avatar_url,university").in("user_id", userIds),
          supabase.from("courses").select("id,name,code,university").in("id", courseIds),
        ]);

        const profileMap = new Map<string, ProfileRow>((profilesData || []).map((row) => [row.user_id, row]));
        const courseMap = new Map<string, CourseRow>((coursesData || []).map((row) => [row.id, row]));

        const normalized = rows
          .map((row) => {
            const profile = profileMap.get(row.user_id);
            const course = courseMap.get(row.course_id);
            if (!course) return null;

            return {
              id: row.id,
              title: row.title || "Başlıksız içerik",
              content: normalizePostContent(row.content),
              createdAt: row.created_at,
              helpfulCount: row.helpful_count || 0,
              commentCount: row.comment_count || 0,
              contentType: row.content_type,
              courseId: row.course_id,
              courseName: course.name,
              courseCode: course.code,
              courseUniversity: course.university,
              authorName: profile?.display_name || profile?.username || "Kullanıcı",
              authorUsername: profile?.username || "kullanıcı",
              authorAvatar: profile?.avatar_url || null,
              authorUserId: row.user_id,
              sameUniversity: !!profileUniversity && !!course.university && profileUniversity === course.university,
            } satisfies FeedTimelineItem;
          })
          .filter((row): row is FeedTimelineItem => row !== null);

        if (!cancelled) {
          setTimelinePosts(normalized);
          setTimelineLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setTimelineError(error instanceof Error ? error.message : "Feed içerikleri alınamadı.");
          setTimelineLoading(false);
        }
      }
    };

    void loadTimelinePosts();

    return () => {
      cancelled = true;
    };
  }, [profileUniversity]);

  const featuredPost = useMemo(() => timelinePosts[0] || null, [timelinePosts]);
  const flowPosts = useMemo(() => (featuredPost ? timelinePosts.filter((post) => post.id !== featuredPost.id) : timelinePosts), [featuredPost, timelinePosts]);

  const myCourseIds = useMemo(() => {
    const all = [
      ...(feedSnapshot?.active_courses || []),
      ...(feedSnapshot?.resume_courses || []),
      ...(feedSnapshot?.recommended_courses || []),
    ];
    return new Set(all.map((row) => row.course_id));
  }, [feedSnapshot?.active_courses, feedSnapshot?.recommended_courses, feedSnapshot?.resume_courses]);

  const filteredFlowPosts = useMemo(() => {
    if (activeTab === "senin_icin") return flowPosts.slice(0, 12);
    if (activeTab === "derslerim") return flowPosts.filter((post) => myCourseIds.has(post.courseId)).slice(0, 12);
    return flowPosts.filter((post) => followingIds.has(post.authorUserId)).slice(0, 12);
  }, [activeTab, flowPosts, followingIds, myCourseIds]);

  const topContextCourses = useMemo(() => {
    const source = [
      ...(feedSnapshot?.resume_courses || []),
      ...(feedSnapshot?.active_courses || []),
      ...(feedSnapshot?.recommended_courses || []),
    ];

    const seen = new Set<string>();
    return source.filter((item) => {
      if (seen.has(item.course_id)) return false;
      seen.add(item.course_id);
      return true;
    }).slice(0, 4);
  }, [feedSnapshot?.active_courses, feedSnapshot?.recommended_courses, feedSnapshot?.resume_courses]);

  const generatedAtText = useMemo(() => {
    if (!feedSnapshot?.generated_at) return "Henüz oluşturulmadı";
    return formatDistanceToNow(new Date(feedSnapshot.generated_at), { addSuffix: true, locale: tr });
  }, [feedSnapshot?.generated_at]);

  const tabs = [
    { key: "senin_icin", label: "Senin İçin", count: flowPosts.length },
    { key: "derslerim", label: "Derslerim", count: flowPosts.filter((item) => myCourseIds.has(item.courseId)).length },
    { key: "takip_edilenler", label: "Takip Edilenler", count: flowPosts.filter((item) => followingIds.has(item.authorUserId)).length },
  ];

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <AppPageHeader
          title="Ana Sayfa"
          description="Ders merkezli akademik keşif akışı: faydalı içeriği bul, doğru Course Hub'a geç, katkını yap."
          icon={<Compass className="h-5 w-5" />}
          actions={
            <>
              <Button asChild size="sm" className="h-9 rounded-xl">
                <Link to="/courses">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Katkı Alanına Git
                </Link>
              </Button>
              <Button asChild size="sm" className="h-9 rounded-xl">
                <Link to="/courses">Ders Hub'larını Aç</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                <Link to="/universities">Üniversiteler</Link>
              </Button>
              <Button asChild size="icon" variant="ghost" className="h-9 w-9 rounded-xl" aria-label="Bildirimler">
                <Link to="/notifications">
                  <Bell className="h-4 w-4" />
                </Link>
              </Button>
            </>
          }
          tabs={
            <PageTabsBar
              items={tabs}
              value={activeTab}
              onChange={(next) => {
                if (isFeedTab(next)) setActiveTab(next);
              }}
            />
          }
        />

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_332px]">
          <div className="space-y-3.5">
            {featuredPost ? (
              <ProductCard highlighted className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Pin className="h-4 w-4 text-primary" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Akademik Öne Çıkan Katkı</p>
                </div>

                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 border border-border/70 shadow-[var(--shadow-soft)]">
                    {featuredPost.authorAvatar ? <AvatarImage src={featuredPost.authorAvatar} alt={featuredPost.authorName} /> : null}
                    <AvatarFallback>{featuredPost.authorName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{featuredPost.authorName}</p>
                      <span className="text-xs text-muted-foreground">@{featuredPost.authorUsername}</span>
                      <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(featuredPost.createdAt), { addSuffix: true, locale: tr })}</span>
                    </div>

                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <ContextChip icon={<BookOpen className="h-3.5 w-3.5 text-primary" />} label={featuredPost.courseName} value={featuredPost.courseCode || ""} />
                      <ContextChip icon={<Building2 className="h-3.5 w-3.5 text-primary" />} label={featuredPost.courseUniversity} />
                    </div>

                    <Link to={`/post/${featuredPost.id}`} className="block">
                      <h2 className="line-clamp-1 text-[1.02rem] font-bold tracking-tight hover:text-primary">{featuredPost.title}</h2>
                      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{featuredPost.content}</p>
                    </Link>

                    <div className="mt-3 flex items-center gap-2">
                      <Button asChild size="sm" className="h-8 rounded-xl">
                        <Link to={`/course/${featuredPost.courseId}`}>Course Hub'a Git</Link>
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 rounded-xl gap-1.5 text-muted-foreground">
                        <ThumbsUp className="h-3.5 w-3.5" /> {featuredPost.helpfulCount}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 rounded-xl gap-1.5 text-muted-foreground">
                        <MessageCircle className="h-3.5 w-3.5" /> {featuredPost.commentCount}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground" aria-label="Paylaş">
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </ProductCard>
            ) : null}

            <PageMetricsRow
              items={[
                {
                  label: "Önerilen Course Hub",
                  value: feedSnapshot?.recommended_courses.length || 0,
                  icon: <BookOpen className="h-4 w-4" />,
                },
                {
                  label: "Ders Bağlamı",
                  value: feedSnapshot?.active_courses.length || 0,
                  icon: <Users className="h-4 w-4" />,
                },
                {
                  label: "Faydalı İçerik",
                  value: feedSnapshot?.useful_posts.length || 0,
                  icon: <TrendingUp className="h-4 w-4" />,
                },
                {
                  label: "Son Güncelleme",
                  value: generatedAtText,
                  icon: <Compass className="h-4 w-4" />,
                },
              ]}
            />

            {activeTab === "derslerim" && myCourseIds.size === 0 && !feedLoading ? (
              <StateBlock
                variant="empty"
                size="section"
                title="Ders bağlamın henüz oluşmadı"
                description="Derslerim sekmesinin çalışması için önce Course Hub ekosisteminde ders seçimi yapman gerekiyor."
                primaryAction={
                  <Button asChild size="sm" className="h-9 rounded-xl">
                    <Link to="/courses">Ders Ekle</Link>
                  </Button>
                }
              />
            ) : null}

            {activeTab === "takip_edilenler" && !followingLoading && followingIds.size === 0 ? (
              <StateBlock
                variant="empty"
                size="section"
                title="Takip ettiğin akademik bağ yok"
                description="Takip ettiğin öğrencilerin ve akademik katkı üreten profillerin içerikleri bu sekmede görünür."
                primaryAction={
                  <Button asChild size="sm" className="h-9 rounded-xl">
                    <Link to="/leaderboard">Katkı Üretenleri Keşfet</Link>
                  </Button>
                }
              />
            ) : null}

            {feedError || timelineError ? (
              <StateBlock
                variant="error"
                size="section"
                title="Feed blokları şu anda yüklenemedi"
                description="Geçici bir kesinti olabilir. Ders akışını Courses ekranından sürdürebilirsiniz."
                primaryAction={
                  <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                    <Link to="/courses">Derslere Git</Link>
                  </Button>
                }
              />
            ) : null}

            {feedLoading || timelineLoading ? (
            <StateBlock variant="loading" size="section" title="Akış yükleniyor" description="Featured ve timeline blokları hazırlanıyor." />
            ) : filteredFlowPosts.length === 0 ? (
              <ProductEmptyState
                icon={<MessageCircle className="h-6 w-6" />}
                title="Bu sekmede içerik bulunamadı"
                description="Farklı bir sekmeye geçerek veya ders akışını genişleterek devam edebilirsiniz."
                actionNode={
                  <Button asChild size="sm" className="h-9 rounded-xl">
                    <Link to="/courses">Dersleri Ac</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-2.5">
                {filteredFlowPosts.map((post) => (
                  <ProductCard key={post.id} interactive className="p-3">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 border border-border/70 shadow-[var(--shadow-soft)]">
                        {post.authorAvatar ? <AvatarImage src={post.authorAvatar} alt={post.authorName} /> : null}
                        <AvatarFallback>{post.authorName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{post.authorName}</p>
                          <span className="text-xs text-muted-foreground">@{post.authorUsername}</span>
                          <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: tr })}</span>
                          <span className="rounded-md border border-border/60 bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {isAcademicContentType(post.contentType) ? getAcademicContentLabel(post.contentType, true) : "İçerik"}
                          </span>
                        </div>

                        <div className="mb-2">
                          <Link to={`/course/${post.courseId}`} className="text-xs font-semibold text-primary hover:underline">
                            {post.courseName} {post.courseCode ? `(${post.courseCode})` : ""}
                          </Link>
                        </div>

                        <Link to={`/post/${post.id}`}>
                          <h3 className="line-clamp-1 text-sm font-semibold hover:text-primary">{post.title}</h3>
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{post.content}</p>
                        </Link>

                        <div className="mt-3 flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-8 rounded-xl gap-1.5 text-muted-foreground">
                            <ThumbsUp className="h-3.5 w-3.5" /> {post.helpfulCount}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 rounded-xl gap-1.5 text-muted-foreground">
                            <MessageCircle className="h-3.5 w-3.5" /> {post.commentCount}
                          </Button>
                          <Button asChild size="sm" variant="outline" className="ml-auto h-8 rounded-xl">
                            <Link to={`/course/${post.courseId}`}>Course Hub</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </ProductCard>
                ))}
              </div>
            )}
          </div>

          <HelperPanel className="hidden bg-gradient-to-b from-card to-card/95 lg:block">
            <HelperCard title="Ana Sayfa Rolu" icon={<TrendingUp className="h-4 w-4" />} highlighted>
              <p className="text-xs text-muted-foreground">
                Ana sayfa dikkat ekonomisi değil, akademik yönlendirme katmanıdır. Doğru bağlamı bulup Course Hub'a geçmeni hızlandırır.
              </p>
            </HelperCard>

            <HelperCard title="Hizli Gecisler" icon={<Compass className="h-4 w-4" />}>
              {topContextCourses.length === 0 ? (
                <p className="text-xs text-muted-foreground">Bağlamsal ders verisi henüz yok.</p>
              ) : (
                <div className="space-y-2">
                  {topContextCourses.map((course) => (
                    <Link key={course.course_id} to={`/course/${course.course_id}`}>
                      <ProductCard className="p-2.5 transition-colors hover:border-primary/35">
                        <p className="line-clamp-1 text-xs font-semibold">{course.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{course.department}</p>
                        <p className="mt-1 text-[11px] font-semibold text-primary">Course Hub'a Git</p>
                      </ProductCard>
                    </Link>
                  ))}
                </div>
              )}
            </HelperCard>

            <HelperCard title="Üst Bağlam" icon={<Building2 className="h-4 w-4" />} className="bg-gradient-to-b from-card to-secondary/20">
                <p className="text-xs text-muted-foreground">Üniversite ve ders bağlamları arasında hızlı geçiş için bu blokları kullan.</p>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" variant="outline" className="h-8 w-full rounded-lg">
                  <Link to="/universities">Üniversiteler</Link>
                </Button>
                <Button asChild size="sm" className="h-8 w-full rounded-lg">
                  <Link to="/courses">Dersler</Link>
                </Button>
              </div>
            </HelperCard>

            <HelperCard title="Akademik Öncelik" icon={<BookOpen className="h-4 w-4" />}>
              <p className="text-xs text-muted-foreground">
                Yaklaşan teslim veya sınav verisi henüz sisteme bağlı değilse bu alan dürüst bir şekilde boş kalır.
              </p>
              <div className="mt-2 rounded-lg border border-dashed border-border/70 bg-secondary/35 p-2 text-[11px] text-muted-foreground">
                Kritik tarih verisi bağlandığında burada otomatik görünecek.
              </div>
            </HelperCard>
          </HelperPanel>
        </div>
      </div>
    </Layout>
  );
}
