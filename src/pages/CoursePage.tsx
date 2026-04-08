import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  ClipboardList,
  Clock,
  Download,
  FileText,
  MessageCircle,
  MessageSquare,
  Plus,
  ThumbsUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import CreatePostDialog from "@/components/CreatePostDialog";
import DiscussionPanel from "@/components/discussion/DiscussionPanel";
import CourseChatPanel from "@/components/course/CourseChatPanel";
import CourseActiveContributorsCard from "@/components/course/CourseActiveContributorsCard";
import CourseFeaturedContentCard from "@/components/course/CourseFeaturedContentCard";
import CourseWiki from "@/components/course/CourseWiki";
import CourseResources from "@/components/course/CourseResources";
import TrendingDiscussions from "@/components/course/TrendingDiscussions";
import RecentContent from "@/components/course/RecentContent";
import CourseOverviewPanel from "@/components/course/CourseOverviewPanel";
import CourseAcademicContentSection from "@/components/course/CourseAcademicContentSection";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { normalizeCourseCode } from "@/lib/course-code";
import { useCourseSocialSignalsV1 } from "@/hooks/useCourseSocialSignalsV1";
import { recordCourseVisitLocal } from "@/lib/course-visits";
import { isAcademicContentType } from "@/lib/academic-content";
import { isCourseNavigationTab, type CourseNavigationTab } from "@/lib/course-navigation";
import type { Database, Tables } from "@/integrations/supabase/types";

type ContentType = Database["public"]["Enums"]["content_type"];
type CourseTab = CourseNavigationTab;
type SortOption = "newest" | "most_voted" | "most_downloaded" | "most_discussed";
type PostWithProfile = Tables<"posts"> & { profiles: Tables<"profiles"> | null };

const SORT_OPTIONS: readonly SortOption[] = ["newest", "most_voted", "most_downloaded", "most_discussed"];

function isSortOption(value: string): value is SortOption {
  return value === "newest" || value === "most_voted" || value === "most_downloaded" || value === "most_discussed";
}

const CONTENT_ACTIONS: Array<{ type: ContentType; label: string; icon: typeof FileText }> = [
  { type: "notes", label: "Not Ekle", icon: FileText },
  { type: "past_exams", label: "Geçmiş Sınav Ekle", icon: ClipboardList },
  { type: "discussion", label: "Tartışma Aç", icon: MessageSquare },
  { type: "kaynaklar", label: "Kaynak Ekle", icon: BookMarked },
];

const EMPTY_COPY: Record<
  ContentType,
  {
    title: string;
    helper: string;
    createAction: string;
  }
> = {
  notes: {
    title: "Henüz ders notu yok",
    helper: "Bu alanda ders özetleri, formüller ve çalışma notları birikir.",
    createAction: "İlk Notu Paylaş",
  },
  past_exams: {
    title: "Henüz geçmiş sınav yok",
    helper: "Vize, final ve quiz arşivini ekleyerek sınav hazırlığını hızlandırabilirsiniz.",
    createAction: "İlk Sınavı Ekle",
  },
  discussion: {
    title: "Henüz tartışma yok",
    helper: "Kavram soruları, sınav stratejileri ve kaynak yorumları için tartışma başlatın.",
    createAction: "İlk Tartışmayı Aç",
  },
  kaynaklar: {
    title: "Henüz kaynak paylaşımı yok",
    helper: "Kitap, video ve bağlantılar bu dersin çalışma kalitesini güçlendirir.",
    createAction: "İlk Kaynağı Ekle",
  },
};

const tabLabelMap: Record<ContentType, string> = {
  notes: "not",
  past_exams: "geçmiş sınav",
  discussion: "tartışma",
  kaynaklar: "kaynak",
};

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [course, setCourse] = useState<Tables<"courses"> | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [activeTab, setActiveTab] = useState<CourseTab>(() => {
    const tabParam = searchParams.get("tab");
    return isCourseNavigationTab(tabParam) ? tabParam : "overview";
  });
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(true);
  const [postError, setPostError] = useState<string | null>(null);
  const [createType, setCreateType] = useState<ContentType | null>(null);
  const tabParam = searchParams.get("tab");

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("university").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const canAddContent = !!user && !!course && userProfile?.university === course.university;
  const {
    data: socialSignals,
    isLoading: socialSignalsLoading,
    isError: socialSignalsError,
    refetch: refetchSocialSignals,
  } = useCourseSocialSignalsV1(id, user?.id);

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from("courses").select("*").eq("id", id).single();
    if (error) {
      setCourse(null);
      return;
    }
    setCourse(data);
  }, [id]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setPostError(null);
    try {
      const { data, error } = await supabase.from("posts").select("*").eq("course_id", id).order("created_at", { ascending: false });
      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((post) => post.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
        const enrichedPosts: PostWithProfile[] = data.map((post) => ({ ...post, profiles: profileMap.get(post.user_id) || null }));
        setPosts(enrichedPosts);
      } else {
        setPosts([]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "İçerikler alınamadı.";
      setPostError(message);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    const nextTab = isCourseNavigationTab(tabParam) ? tabParam : "overview";
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [tabParam]);

  useEffect(() => {
    const currentTab = searchParams.get("tab");

    if (activeTab === "overview") {
      if (currentTab === null) return;
      const next = new URLSearchParams(searchParams);
      next.delete("tab");
      setSearchParams(next, { replace: true });
      return;
    }

    if (currentTab === activeTab) return;

    const next = new URLSearchParams(searchParams);
    next.set("tab", activeTab);
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (!id) return;
    void fetchCourse();
    void fetchPosts();
  }, [id, fetchCourse, fetchPosts]);

  useEffect(() => {
    if (!id) return;
    recordCourseVisitLocal(id, "course");
    if (!user) return;

    void (async () => {
      const { error } = await supabase.rpc("touch_course_visit", { p_course_id: id, p_source: "course" });
      if (!error) return;
      if (error.code === "42883" || error.code === "42P01") return;
      console.error("touch_course_visit failed", error);
    })();
  }, [id, user]);

  useEffect(() => {
    if (!course) return;
    const normalizedCode = normalizeCourseCode(course.code);
    document.title = `${course.name} Course Hub | ACATALK`;
    const description = `${course.name}${normalizedCode ? ` (${normalizedCode})` : ""} - ${course.department} dersi için Genel Bakış, Tartışmalar, Notlar, Geçmiş Sınavlar, Kaynaklar ve Sohbet.`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", description);
    } else {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = description;
      document.head.appendChild(meta);
    }

    return () => {
      document.title = "ACATALK";
    };
  }, [course]);

  const selectedContentType = useMemo<ContentType | null>(() => {
    if (activeTab === "chat" || activeTab === "discussion" || activeTab === "overview") return null;
    return activeTab;
  }, [activeTab]);

  const recentOverviewPosts = useMemo(
    () => posts.slice(0, 10).map((post) => ({
      id: post.id,
      title: post.title,
      content_type: post.content_type,
      created_at: post.created_at,
      helpful_count: post.helpful_count,
      comment_count: post.comment_count,
    })),
    [posts],
  );

  const filteredPosts = useMemo(() => {
    if (!selectedContentType) return [];

    return posts
      .filter((post) => post.content_type === selectedContentType)
      .sort((a, b) => {
        switch (sortBy) {
          case "most_voted":
            return (b.helpful_count ?? 0) - (a.helpful_count ?? 0);
          case "most_downloaded":
            return (b.download_count ?? 0) - (a.download_count ?? 0);
          case "most_discussed":
            return (b.comment_count ?? 0) - (a.comment_count ?? 0);
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });
  }, [posts, selectedContentType, sortBy]);

  const tabCounts = useMemo(
    () => ({
      notes: posts.filter((post) => post.content_type === "notes").length,
      past_exams: posts.filter((post) => post.content_type === "past_exams").length,
      discussion: posts.filter((post) => post.content_type === "discussion").length,
      kaynaklar: posts.filter((post) => post.content_type === "kaynaklar").length,
    }),
    [posts],
  );

  const tabs: Array<{
    value: CourseTab;
    label: string;
    icon: typeof FileText;
    count?: number;
    badge?: string;
    tooltip: string;
  }> = [
    { value: "overview", label: "Genel Bakış", icon: BookOpen, tooltip: "Dersin özet paneli" },
    { value: "notes", label: "Notlar", icon: FileText, count: tabCounts.notes, tooltip: `${tabCounts.notes} not` },
    {
      value: "past_exams",
      label: "Geçmiş Sınavlar",
      icon: ClipboardList,
      count: tabCounts.past_exams,
      tooltip: `${tabCounts.past_exams} geçmiş sınav`,
    },
    {
      value: "discussion",
      label: "Tartışmalar",
      icon: MessageSquare,
      count: tabCounts.discussion,
      tooltip: `${tabCounts.discussion} tartışma`,
    },
    { value: "kaynaklar", label: "Kaynaklar", icon: BookMarked, count: tabCounts.kaynaklar, tooltip: `${tabCounts.kaynaklar} kaynak` },
    { value: "chat", label: "Sohbet", icon: MessageCircle, badge: "Canlı", tooltip: "Ders sohbeti" },
  ];

  const tabGuidance = useMemo<{
    title: string;
    description: string;
    ctaLabel?: string;
    ctaTab?: CourseTab;
  }>(() => {
    if (activeTab === "overview") {
      return {
        title: "Genel Bakış dersin giriş kontrol panelidir",
        description: "Bu panelden Tartışmalar, Notlar, Geçmiş Sınavlar, Kaynaklar ve Sohbet alanlarına doğrudan geçiş yapabilirsiniz.",
        ctaLabel: "Tartışmalara Geç",
        ctaTab: "discussion",
      };
    }

    if (activeTab === "chat") {
      return {
        title: "Sohbet hızlı koordinasyon alanıdır",
        description: "Kalıcı bilgi için Tartışmalar sekmesinde başlık açın veya mevcut tartışmalara yanıt verin.",
        ctaLabel: "Tartışmalara Geç",
        ctaTab: "discussion",
      };
    }

    if (activeTab === "discussion") {
      return {
        title: "Tartışmalar dersin kalıcı akademik hafızasıdır",
        description: "Kısa koordinasyon ve anlık yardım için Sohbet sekmesine geçebilirsiniz.",
        ctaLabel: "Sohbete Geç",
        ctaTab: "chat",
      };
    }

    return {
      title: "Bu sekme ders içeriği üretim alanıdır",
      description: "Notlar, Geçmiş Sınavlar ve Kaynaklar katkıları dersi yaşayan bir bilgi merkezi haline getirir.",
      ctaLabel: selectedContentType && canAddContent ? EMPTY_COPY[selectedContentType].createAction : undefined,
      ctaTab: undefined,
    };
  }, [activeTab, canAddContent, selectedContentType]);

  const handleTrendingSelect = (postId: string) => {
    setActiveTab("discussion");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("select-discussion", { detail: postId }));
    }, 100);
  };

  if (!course && !loading) {
    return (
      <Layout>
        <div className="container mx-auto max-w-3xl px-4 py-12">
          <StateBlock
            variant="noResults"
            size="section"
            title="Ders bulunamadı"
            description="Ders kaldırılmış olabilir veya bağlantı geçersiz olabilir."
            primaryAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/courses">Derslere Dön</Link>
              </Button>
            }
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <Link
          to="/courses"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Derslere Dön
        </Link>

        {course && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Surface className="mb-0 overflow-hidden rounded-b-none" variant="raised" padding="none" border="none" radius="xl">
              <div className="gradient-hero px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/75">
                      {course.university} · {course.department}
                    </p>
                    <div className="mb-1 flex items-center gap-2">
                      {normalizeCourseCode(course.code) && (
                        <span className="text-xs font-bold uppercase tracking-wider text-primary-foreground/85">
                          {normalizeCourseCode(course.code)}
                        </span>
                      )}
                      {course.year !== null && course.year !== undefined && (
                        <span className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground/90">
                          {course.year === 0 ? "Hazırlık" : `${course.year}. Sınıf`}
                        </span>
                      )}
                    </div>
                    <h1 className="font-heading text-xl font-extrabold tracking-tight text-primary-foreground sm:text-2xl">{course.name}</h1>
                    <p className="mt-0.5 text-xs font-medium text-primary-foreground/70">
                      Course Hub: Genel Bakış, Tartışmalar, Notlar, Geçmiş Sınavlar, Kaynaklar ve Sohbet.
                    </p>
                    {course.description && <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-primary-foreground/55">{course.description}</p>}
                  </div>

                    {canAddContent && (
                     <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            className="h-9 gap-1.5 rounded-xl border-0 bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30"
                          >
                            <Plus className="h-4 w-4" /> Katkı Ekle
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {CONTENT_ACTIONS.map((action) => {
                            const Icon = action.icon;
                            return (
                              <DropdownMenuItem
                                key={action.type}
                                onClick={() => {
                                  if (action.type === "discussion") {
                                    setActiveTab("discussion");
                                  } else {
                                    setCreateType(action.type);
                                  }
                                }}
                                className="cursor-pointer gap-2"
                              >
                                <Icon className="h-4 w-4 text-primary" />
                                {action.label}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {activeTab === "chat" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] text-primary-foreground/90 hover:bg-primary-foreground/15 hover:text-primary-foreground"
                          onClick={() => setActiveTab("discussion")}
                        >
                          Tartışmaya Geç
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </Surface>
          </motion.div>
        )}

        <div className="sticky top-[64px] z-30 -mx-3 px-3 sm:-mx-4 sm:px-4">
          <div className="rounded-b-xl border border-t-0 border-border bg-card" style={{ boxShadow: "var(--shadow-warm)" }}>
            <div className="scrollbar-none flex items-stretch overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                    {typeof tab.count === "number" ? (
                      <span
                        className={`ml-0.5 min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${
                          isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                        }`}
                        title={tab.tooltip}
                      >
                        {tab.count}
                      </span>
                    ) : (
                      <span
                        className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                        title={tab.tooltip}
                      >
                        {tab.badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="course-tab-indicator"
                        className="absolute bottom-0 left-2 right-2 h-[3px] rounded-t-full bg-primary"
                        transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <Surface variant="soft" border="subtle" padding="sm" radius="lg" className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">{tabGuidance.title}</p>
              <p className="text-[11px] text-muted-foreground">{tabGuidance.description}</p>
            </div>
            {tabGuidance.ctaTab ? (
              <Button size="sm" variant="outline" className="h-8" onClick={() => setActiveTab(tabGuidance.ctaTab)}>
                {tabGuidance.ctaLabel}
              </Button>
            ) : selectedContentType && canAddContent ? (
              <Button size="sm" className="h-8" onClick={() => setCreateType(selectedContentType)}>
                {tabGuidance.ctaLabel}
              </Button>
            ) : null}
          </Surface>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_304px]">
          <div className="min-h-[440px] min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
                {activeTab === "discussion" ? (
                  <DiscussionPanel courseId={id!} />
                ) : activeTab === "overview" && course ? (
                  <CourseOverviewPanel
                    course={course}
                    canAddContent={canAddContent}
                    tabCounts={tabCounts}
                    recentPosts={recentOverviewPosts}
                    socialSignals={socialSignals}
                    onSelectSection={(section) => setActiveTab(section)}
                  />
                ) : activeTab === "chat" ? (
                  <CourseChatPanel
                    courseId={id!}
                    courseName={course?.name || "Ders"}
                    courseUniversity={course?.university || ""}
                    canWrite={canAddContent}
                    isLoggedIn={!!user}
                    userId={user?.id}
                    onOpenDiscussionTab={() => setActiveTab("discussion")}
                  />
                ) : (
                  <>
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {filteredPosts.length} {selectedContentType ? tabLabelMap[selectedContentType] : "içerik"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Select value={sortBy} onValueChange={(value) => {
                          if (isSortOption(value)) setSortBy(value);
                        }}>
                          <SelectTrigger className="h-8 w-40 rounded-xl border-border/50 bg-secondary/45 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" /> En Yeni
                              </span>
                            </SelectItem>
                            <SelectItem value="most_voted">
                              <span className="flex items-center gap-1.5">
                                <ThumbsUp className="h-3 w-3" /> En Çok Oylanan
                              </span>
                            </SelectItem>
                            <SelectItem value="most_downloaded">
                              <span className="flex items-center gap-1.5">
                                <Download className="h-3 w-3" /> En Çok İndirilen
                              </span>
                            </SelectItem>
                            <SelectItem value="most_discussed">
                              <span className="flex items-center gap-1.5">
                                <MessageSquare className="h-3 w-3" /> En Çok Tartışılan
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedContentType && isAcademicContentType(selectedContentType) && selectedContentType !== "discussion" ? (
                      <CourseAcademicContentSection
                        courseId={id!}
                        sectionType={selectedContentType}
                        posts={filteredPosts}
                        loading={loading}
                        error={postError}
                        canAddContent={canAddContent}
                        isLoggedIn={!!user}
                        onCreate={() => setCreateType(selectedContentType)}
                        onRetry={() => {
                          void fetchPosts();
                        }}
                      />
                    ) : (
                      <StateBlock
                        variant="error"
                        size="section"
                        title="Sekme yapılandırması uyumsuz"
                        description="Bu sekme tipi için içerik yüzeyi bulunamadı."
                        primaryAction={
                          <Button size="sm" variant="outline" onClick={() => setActiveTab("overview")}>
                            Genel Bakışa Dön
                          </Button>
                        }
                      />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {id && (
            <aside className="hidden lg:block">
              <div className="scrollbar-none sticky top-16 max-h-[calc(100vh-5rem)] space-y-3 overflow-y-auto pb-4">
                <Surface variant="outline" border="subtle" padding="sm" radius="lg">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ders Yardımcı Alanı</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Katkı sinyalleri, ders wiki ve hızlı geçiş kartları burada toplanır.</p>
                </Surface>
                <CourseActiveContributorsCard
                  contributors={socialSignals?.contributors || []}
                  loading={socialSignalsLoading}
                  hasError={socialSignalsError}
                  onRetry={() => {
                    void refetchSocialSignals();
                  }}
                />
                <CourseFeaturedContentCard
                  courseId={id}
                  featuredContent={socialSignals?.featured_content || []}
                  loading={socialSignalsLoading}
                  hasError={socialSignalsError}
                  onRetry={() => {
                    void refetchSocialSignals();
                  }}
                />
                <CourseWiki courseId={id} />
                <TrendingDiscussions courseId={id} onSelect={handleTrendingSelect} />
                <RecentContent courseId={id} />
                <CourseResources courseId={id} />
              </div>
            </aside>
          )}
        </div>

        {id && (
          <div className="mt-6 space-y-3 lg:hidden">
            <CourseActiveContributorsCard
              contributors={socialSignals?.contributors || []}
              loading={socialSignalsLoading}
              hasError={socialSignalsError}
              onRetry={() => {
                void refetchSocialSignals();
              }}
            />
            <CourseFeaturedContentCard
              courseId={id}
              featuredContent={socialSignals?.featured_content || []}
              loading={socialSignalsLoading}
              hasError={socialSignalsError}
              onRetry={() => {
                void refetchSocialSignals();
              }}
            />
            <CourseWiki courseId={id} />
            <TrendingDiscussions courseId={id} onSelect={handleTrendingSelect} />
            <RecentContent courseId={id} />
            <CourseResources courseId={id} />
          </div>
        )}
      </div>

      {canAddContent && createType && id && (
        <CreatePostDialog
          courseId={id}
          defaultType={createType}
          lockedContentType={createType}
          onCreated={(createdType) => {
            void fetchPosts();
            if (createdType && isAcademicContentType(createdType)) {
              setActiveTab(createdType);
            }
            setCreateType(null);
          }}
          externalOpen={true}
          onOpenChange={(open) => {
            if (!open) setCreateType(null);
          }}
        />
      )}
    </Layout>
  );
}
