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
import { useAuth } from "@/contexts/AuthContext";
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


type FeedTab = "kesfet" | "derslerim" | "takip";
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
  contentType: string;
  courseId: string;
  courseName: string;
  courseCode: string | null;
  courseUniversity: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string | null;
  sameUniversity: boolean;
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  notes: "Not",
  past_exams: "Sinav",
  discussion: "Tartisma",
  kaynaklar: "Kaynak",
};

function normalizePostContent(raw: string | null | undefined) {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}

export default function FeedPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FeedTab>("kesfet");
  const [timelinePosts, setTimelinePosts] = useState<FeedTimelineItem[]>([]);
  const [profileUniversity, setProfileUniversity] = useState<string | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(true);
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
    let cancelled = false;

    const loadTimelinePosts = async () => {
      setTimelineLoading(true);
      setTimelineError(null);
      try {
        const { data: postsData, error: postsError } = await supabase
          .from("posts")
          .select("id,title,content,content_type,created_at,helpful_count,comment_count,course_id,user_id")
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(40);

        if (postsError) throw postsError;
        const rows = (postsData || []) as PostRow[];

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

        const profileMap = new Map((profilesData || []).map((row) => [row.user_id, row as ProfileRow]));
        const courseMap = new Map((coursesData || []).map((row) => [row.id, row as CourseRow]));

        const normalized = rows
          .map((row) => {
            const profile = profileMap.get(row.user_id);
            const course = courseMap.get(row.course_id);
            if (!course) return null;

            return {
              id: row.id,
              title: row.title || "Basliksiz icerik",
              content: normalizePostContent(row.content),
              createdAt: row.created_at,
              helpfulCount: row.helpful_count || 0,
              commentCount: row.comment_count || 0,
              contentType: row.content_type || "notes",
              courseId: row.course_id,
              courseName: course.name,
              courseCode: course.code,
              courseUniversity: course.university,
              authorName: profile?.display_name || profile?.username || "Kullanici",
              authorUsername: profile?.username || "kullanici",
              authorAvatar: profile?.avatar_url || null,
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
          setTimelineError(error instanceof Error ? error.message : "Feed icerikleri alinamadi.");
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
    if (activeTab === "kesfet") return flowPosts.slice(0, 12);
    if (activeTab === "derslerim") return flowPosts.filter((post) => myCourseIds.has(post.courseId)).slice(0, 12);
    return flowPosts.filter((post) => post.sameUniversity).slice(0, 12);
  }, [activeTab, flowPosts, myCourseIds]);

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
    if (!feedSnapshot?.generated_at) return "Henuz olusturulmadi";
    return formatDistanceToNow(new Date(feedSnapshot.generated_at), { addSuffix: true, locale: tr });
  }, [feedSnapshot?.generated_at]);

  const tabs = [
    { key: "kesfet", label: "Kesfet", count: flowPosts.length },
    { key: "derslerim", label: "Derslerim", count: flowPosts.filter((item) => myCourseIds.has(item.courseId)).length },
    { key: "takip", label: "Takip", count: flowPosts.filter((item) => item.sameUniversity).length },
  ];

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <AppPageHeader
          title="Ana Akis"
          description="Kesif, etkileşim ve ders baglamini tek akista birlestiren final feed yuzeyi."
          icon={<Compass className="h-5 w-5" />}
          actions={
            <>
              <Button asChild size="sm" className="h-9 rounded-xl">
                <Link to="/">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Icerik Olustur
                </Link>
              </Button>
              <Button asChild size="sm" className="h-9 rounded-xl">
                <Link to="/courses">Dersleri Kesfet</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                <Link to="/universities">Universiteler</Link>
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" aria-label="Bildirimler">
                <Bell className="h-4 w-4" />
              </Button>
            </>
          }
          tabs={<PageTabsBar items={tabs} value={activeTab} onChange={(next) => setActiveTab(next as FeedTab)} />}
        />

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_332px]">
          <div className="space-y-3.5">
            {featuredPost ? (
              <ProductCard highlighted className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Pin className="h-4 w-4 text-primary" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Featured Akademik Blok</p>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground" aria-label="Paylas">
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
                  label: "Onerilen Ders",
                  value: feedSnapshot?.recommended_courses.length || 0,
                  icon: <BookOpen className="h-4 w-4" />,
                },
                {
                  label: "Aktif Ders",
                  value: feedSnapshot?.active_courses.length || 0,
                  icon: <Users className="h-4 w-4" />,
                },
                {
                  label: "Faydali Icerik",
                  value: feedSnapshot?.useful_posts.length || 0,
                  icon: <TrendingUp className="h-4 w-4" />,
                },
                {
                  label: "Son Uretim",
                  value: generatedAtText,
                  icon: <Compass className="h-4 w-4" />,
                },
              ]}
            />

            {feedError || timelineError ? (
              <StateBlock
                variant="error"
                size="section"
                title="Feed bloklari su anda yuklenemedi"
                description="Gecici bir kesinti olabilir. Ders akisini Courses ekranindan surdurebilirsiniz."
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
                description="Farkli bir sekmeye gecerek veya ders akisini genisleterek devam edebilirsiniz."
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
                            {CONTENT_TYPE_LABEL[post.contentType] || "Icerik"}
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
            <HelperCard title="Akisin Rolu" icon={<TrendingUp className="h-4 w-4" />} highlighted>
              <p className="text-xs text-muted-foreground">
                Feed yalnizca kesif katmanidir: dogru baglami bulup Course Hub ekranina gecmeni hizlandirir.
              </p>
            </HelperCard>

            <HelperCard title="Hizli Gecisler" icon={<Compass className="h-4 w-4" />}>
              {topContextCourses.length === 0 ? (
                <p className="text-xs text-muted-foreground">Baglamsal ders verisi henuz yok.</p>
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

            <HelperCard title="Ust Baglam" icon={<Building2 className="h-4 w-4" />} className="bg-gradient-to-b from-card to-secondary/20">
                <p className="text-xs text-muted-foreground">Üniversite ve ders bağlamları arasında hızlı geçiş için bu blokları kullan.</p>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" variant="outline" className="h-8 w-full rounded-lg">
                  <Link to="/universities">Universiteler</Link>
                </Button>
                <Button asChild size="sm" className="h-8 w-full rounded-lg">
                  <Link to="/courses">Dersler</Link>
                </Button>
              </div>
            </HelperCard>
          </HelperPanel>
        </div>
      </div>
    </Layout>
  );
}
