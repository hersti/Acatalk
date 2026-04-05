import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  ClipboardList,
  MessageSquare,
  BookMarked,
  Download,
  ThumbsUp,
  Clock,
  Plus,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import DiscussionPanel from "@/components/discussion/DiscussionPanel";
import CourseChatPanel from "@/components/course/CourseChatPanel";
import CourseActiveContributorsCard from "@/components/course/CourseActiveContributorsCard";
import CourseFeaturedContentCard from "@/components/course/CourseFeaturedContentCard";
import CourseWiki from "@/components/course/CourseWiki";
import CourseResources from "@/components/course/CourseResources";
import TrendingDiscussions from "@/components/course/TrendingDiscussions";
import RecentContent from "@/components/course/RecentContent";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { normalizeCourseCode } from "@/lib/course-code";
import { useCourseSocialSignalsV1 } from "@/hooks/useCourseSocialSignalsV1";
import { recordCourseVisitLocal } from "@/lib/course-visits";
import type { Database, Tables } from "@/integrations/supabase/types";

type ContentType = Database["public"]["Enums"]["content_type"];
type CourseTab = ContentType | "chat";
type SortOption = "newest" | "most_voted" | "most_downloaded" | "most_discussed";
type PostWithProfile = Tables<"posts"> & { profiles: Tables<"profiles"> | null };

const CONTENT_ACTIONS = [
  { type: "notes" as ContentType, label: "Not Ekle", icon: FileText },
  { type: "past_exams" as ContentType, label: "Cikmis Soru Ekle", icon: ClipboardList },
  { type: "discussion" as ContentType, label: "Tartisma Ac", icon: MessageSquare },
  { type: "kaynaklar" as ContentType, label: "Kaynak Ekle", icon: BookMarked },
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
    helper: "Bu alanda ders ozetleri, formuller ve calisma notlari birikir.",
    createAction: "Ilk Notu Paylas",
  },
  past_exams: {
    title: "Henüz çıkmış soru yok",
    helper: "Vize ve final sorularini ekleyerek sinav hazirligini hizlandirabilirsiniz.",
    createAction: "Ilk Soruyu Ekle",
  },
  discussion: {
    title: "Henüz tartışma yok",
    helper: "Kavram sorulari, sinav stratejileri ve kaynak yorumlari icin tartisma baslatin.",
    createAction: "Ilk Tartismayi Ac",
  },
  kaynaklar: {
    title: "Henüz kaynak paylaşımı yok",
    helper: "Kitap, video ve faydali baglantilar bu dersin calisma kalitesini arttirir.",
    createAction: "Ilk Kaynagi Ekle",
  },
};

const tabLabelMap: Record<ContentType, string> = {
  notes: "not",
  past_exams: "cikmis soru",
  discussion: "tartisma",
  kaynaklar: "kaynak",
};

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();

  const [course, setCourse] = useState<Tables<"courses"> | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [activeTab, setActiveTab] = useState<CourseTab>("notes");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(true);
  const [createType, setCreateType] = useState<ContentType | null>(null);

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("university").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const canAddContent = !!user && !!course && userProfile?.university === course.university;
  const { data: socialSignals, isLoading: socialSignalsLoading, isError: socialSignalsError, refetch: refetchSocialSignals } = useCourseSocialSignalsV1(
    id,
    user?.id,
  );

  const fetchCourse = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("courses").select("*").eq("id", id).single();
    setCourse(data as Tables<"courses"> | null);
  }, [id]);

  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data } = await supabase.from("posts").select("*").eq("course_id", id).order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((post) => post.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      setPosts(data.map((post) => ({ ...post, profiles: profileMap.get(post.user_id) || null })) as PostWithProfile[]);
    } else {
      setPosts([]);
    }
    setLoading(false);
  }, [id]);

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
    document.title = `${course.name} Notlari ve Tartismalari | ACATALK`;
    const description = `${course.name}${normalizedCode ? ` (${normalizedCode})` : ""} - ${course.department} dersi icin notlar, cikmis sorular, tartismalar, kaynaklar ve ders sohbeti.`;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", description);
    else {
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
    if (activeTab === "chat" || activeTab === "discussion") return null;
    return activeTab;
  }, [activeTab]);

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

  const tabCounts = useMemo(() => ({
    notes: posts.filter((post) => post.content_type === "notes").length,
    past_exams: posts.filter((post) => post.content_type === "past_exams").length,
    discussion: posts.filter((post) => post.content_type === "discussion").length,
    kaynaklar: posts.filter((post) => post.content_type === "kaynaklar").length,
  }), [posts]);

  const tabs: Array<{
    value: CourseTab;
    label: string;
    icon: typeof FileText;
    count?: number;
    badge?: string;
    tooltip: string;
  }> = [
    { value: "notes", label: "Notlar", icon: FileText, count: tabCounts.notes, tooltip: `${tabCounts.notes} not` },
    { value: "past_exams", label: "Cikmis Sorular", icon: ClipboardList, count: tabCounts.past_exams, tooltip: `${tabCounts.past_exams} sinav sorusu` },
    { value: "discussion", label: "Tartismalar", icon: MessageSquare, count: tabCounts.discussion, tooltip: `${tabCounts.discussion} tartisma` },
    { value: "kaynaklar", label: "Kaynaklar", icon: BookMarked, count: tabCounts.kaynaklar, tooltip: `${tabCounts.kaynaklar} kaynak` },
    { value: "chat", label: "Sohbet", icon: MessageCircle, badge: "Yeni", tooltip: "Ders sohbeti" },
  ];

  const handleTrendingSelect = (postId: string) => {
    setActiveTab("discussion");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("select-discussion", { detail: postId }));
    }, 100);
  };

  if (!course && !loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <StateBlock
            variant="noResults"
            size="section"
            title="Ders bulunamadi"
            description="Ders kaldirilmis olabilir veya baglanti gecersiz olabilir."
            primaryAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/">Derslere Don</Link>
              </Button>
            }
          />
        </div>
      </Layout>
    );
  }

  const emptyConfig = selectedContentType ? EMPTY_COPY[selectedContentType] : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-3 font-medium">
          <ArrowLeft className="h-4 w-4" /> Tum Dersler
        </Link>

        {course && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Surface className="mb-0 overflow-hidden rounded-b-none" variant="raised" padding="none" border="none" radius="xl">
              <div className="gradient-hero px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {normalizeCourseCode(course.code) && (
                        <span className="text-xs font-bold tracking-wider uppercase text-primary-foreground/80">{normalizeCourseCode(course.code)}</span>
                      )}
                      {course.year !== null && course.year !== undefined && (
                        <span className="text-[10px] font-semibold bg-primary-foreground/15 px-2 py-0.5 rounded-full text-primary-foreground/90">
                          {course.year === 0 ? "Hazirlik" : `${course.year}. Sinif`}
                        </span>
                      )}
                    </div>
                    <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-primary-foreground tracking-tight">{course.name}</h1>
                    <p className="text-xs text-primary-foreground/60 mt-0.5 font-medium">{course.department}</p>
                    {course.description && <p className="text-xs text-primary-foreground/50 mt-1.5 max-w-xl leading-relaxed">{course.description}</p>}
                  </div>

                  {canAddContent && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" className="gap-1.5 shrink-0 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0">
                          <Plus className="h-4 w-4" /> Icerik Ekle
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
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
                              className="gap-2 cursor-pointer"
                            >
                              <Icon className="h-4 w-4 text-primary" />
                              {action.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </Surface>
          </motion.div>
        )}

        <div className="sticky top-[56px] z-30 -mx-4 px-4 mb-4">
          <div className="bg-card border border-t-0 border-border rounded-b-xl" style={{ boxShadow: "var(--shadow-warm)" }}>
            <div className="flex items-stretch overflow-x-auto scrollbar-none">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`relative flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors ${
                      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                    {typeof tab.count === "number" ? (
                      <span
                        className={`ml-0.5 text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${
                          isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"
                        }`}
                        title={tab.tooltip}
                      >
                        {tab.count}
                      </span>
                    ) : (
                      <span className="ml-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-primary/10 text-primary" title={tab.tooltip}>
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
          <div className="min-w-0 min-h-[440px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "discussion" ? (
                  <DiscussionPanel courseId={id!} />
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
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="text-xs text-muted-foreground font-medium">
                        {filteredPosts.length} {selectedContentType ? tabLabelMap[selectedContentType] : "icerik"}
                      </p>
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                        <SelectTrigger className="w-36 h-8 text-xs rounded-lg bg-secondary/50 border-transparent">
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
                              <ThumbsUp className="h-3 w-3" /> En Cok Oylanan
                            </span>
                          </SelectItem>
                          <SelectItem value="most_downloaded">
                            <span className="flex items-center gap-1.5">
                              <Download className="h-3 w-3" /> En Cok Indirilen
                            </span>
                          </SelectItem>
                          <SelectItem value="most_discussed">
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="h-3 w-3" /> En Cok Tartisilan
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      {loading ? (
                        <StateBlock
                          variant="loading"
                          size="section"
                          title="Icerikler yukleniyor"
                          description="Ders icerikleri hazirlaniyor."
                        />
                      ) : filteredPosts.length > 0 ? (
                        filteredPosts.map((post, index) => (
                          <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.03 }}>
                            <PostCard post={post} onVoted={fetchPosts} showAdminActions={isAdmin} />
                          </motion.div>
                        ))
                      ) : (
                        <StateBlock
                          variant="empty"
                          size="section"
                          title={emptyConfig?.title || "Henüz içerik yok"}
                          description={
                            !user
                              ? `${emptyConfig?.helper || ""} Katki icin giris yapabilirsiniz.`
                              : canAddContent
                                ? `${emptyConfig?.helper || ""} Ilk katkıyı siz başlatabilirsiniz.`
                                : "Sadece kendi universitenizin derslerine icerik ekleyebilirsiniz."
                          }
                          primaryAction={
                            !user ? (
                              <Button asChild variant="outline" size="sm">
                                <Link to="/auth">Giris Yap</Link>
                              </Button>
                            ) : canAddContent && selectedContentType ? (
                              <Button size="sm" onClick={() => setCreateType(selectedContentType)}>
                                {emptyConfig?.createAction || "Ilk Katkiyi Ekle"}
                              </Button>
                            ) : (
                              <Button asChild variant="outline" size="sm">
                                <Link to="/settings">Profili Duzenle</Link>
                              </Button>
                            )
                          }
                          secondaryAction={
                            <Button size="sm" variant="ghost" onClick={() => setActiveTab("discussion")}>
                              Tartismalari Ac
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {id && (
            <aside className="hidden lg:block">
              <div className="sticky top-16 space-y-3 max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-none pb-4">
                <CourseActiveContributorsCard
                  contributors={socialSignals?.contributors || []}
                  loading={socialSignalsLoading}
                  hasError={socialSignalsError}
                  onRetry={() => {
                    void refetchSocialSignals();
                  }}
                />
                <CourseFeaturedContentCard
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
          <div className="lg:hidden space-y-3 mt-6">
            <CourseActiveContributorsCard
              contributors={socialSignals?.contributors || []}
              loading={socialSignalsLoading}
              hasError={socialSignalsError}
              onRetry={() => {
                void refetchSocialSignals();
              }}
            />
            <CourseFeaturedContentCard
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
          onCreated={() => {
            void fetchPosts();
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
