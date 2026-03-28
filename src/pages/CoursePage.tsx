import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/Layout";
import PostCard from "@/components/PostCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import DiscussionPanel from "@/components/discussion/DiscussionPanel";
import CourseWiki from "@/components/course/CourseWiki";
import CourseResources from "@/components/course/CourseResources";
import TrendingDiscussions from "@/components/course/TrendingDiscussions";
import RecentContent from "@/components/course/RecentContent";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, ClipboardList, MessageSquare, BookMarked, Download, ThumbsUp, Clock, Plus } from "lucide-react";
import type { Tables, Database } from "@/integrations/supabase/types";
import { normalizeCourseCode } from "@/lib/course-code";

type ContentType = Database["public"]["Enums"]["content_type"];
type PostWithProfile = Tables<"posts"> & { profiles: Tables<"profiles"> | null };
type SortOption = "newest" | "most_voted" | "most_downloaded" | "most_discussed";

const CONTENT_ACTIONS = [
  { type: "notes" as ContentType, label: "Not Yükle", icon: FileText },
  { type: "past_exams" as ContentType, label: "Çıkmış Soru Ekle", icon: ClipboardList },
  { type: "kaynaklar" as ContentType, label: "Kaynak Ekle", icon: BookMarked },
  { type: "discussion" as ContentType, label: "Tartışma Aç", icon: MessageSquare },
];

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [course, setCourse] = useState<any>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [activeTab, setActiveTab] = useState<ContentType>("notes");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [loading, setLoading] = useState(true);
  const [createType, setCreateType] = useState<ContentType | null>(null);

  // Fetch user's profile to check university match
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("university").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const canAddContent = !!user && !!course && userProfile?.university === course.university;

  useEffect(() => { if (id) { fetchCourse(); fetchPosts(); } }, [id]);

  useEffect(() => {
    if (course) {
      const title = `${course.name} Notları ve Tartışmaları | ACATALK`;
      document.title = title;
      const metaDesc = document.querySelector('meta[name="description"]');
      const normalizedCode = normalizeCourseCode(course.code);
      const desc = `${course.name}${normalizedCode ? ` (${normalizedCode})` : ""} - ${course.department} dersi için notlar, çıkmış sorular, tartışmalar ve kaynaklar.`;
      if (metaDesc) {
        metaDesc.setAttribute("content", desc);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = desc;
        document.head.appendChild(meta);
      }
    }
    return () => { document.title = "ACATALK"; };
  }, [course]);

  const fetchCourse = async () => {
    const { data } = await supabase.from("courses").select("*").eq("id", id!).single();
    setCourse(data);
  };

  const fetchPosts = async () => {
    setLoading(true);
    const { data } = await supabase.from("posts").select("*").eq("course_id", id!).order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      setPosts(data.map((p) => ({ ...p, profiles: profileMap.get(p.user_id) || null })) as PostWithProfile[]);
    } else { setPosts([]); }
    setLoading(false);
  };

  const filteredPosts = posts
    .filter((p) => p.content_type === activeTab)
    .sort((a, b) => {
      switch (sortBy) {
        case "most_voted": return (b.helpful_count ?? 0) - (a.helpful_count ?? 0);
        case "most_downloaded": return ((b as any).download_count ?? 0) - ((a as any).download_count ?? 0);
        case "most_discussed": return ((b as any).comment_count ?? 0) - ((a as any).comment_count ?? 0);
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const tabCounts = {
    notes: posts.filter((p) => p.content_type === "notes").length,
    past_exams: posts.filter((p) => p.content_type === "past_exams").length,
    discussion: posts.filter((p) => p.content_type === "discussion").length,
    kaynaklar: posts.filter((p) => p.content_type === "kaynaklar").length,
  };

  const contentTypeLabel = (type: string) => {
    const labels: Record<string, string> = { notes: "notlar", past_exams: "çıkmış sorular", discussion: "tartışma", kaynaklar: "kaynaklar" };
    return labels[type] || type;
  };

  const handleTrendingSelect = (postId: string) => {
    setActiveTab("discussion");
    setTimeout(() => {
      const event = new CustomEvent("select-discussion", { detail: postId });
      window.dispatchEvent(event);
    }, 100);
  };

  if (!course && !loading) {
    return <Layout><div className="container mx-auto px-4 py-16 text-center"><p className="text-muted-foreground">Ders bulunamadı.</p><Link to="/" className="text-primary hover:underline text-sm mt-2 inline-block">Derslere dön</Link></div></Layout>;
  }

  const tabs = [
    { value: "notes" as ContentType, label: "Notlar", icon: FileText, count: tabCounts.notes, tooltip: `${tabCounts.notes} not` },
    { value: "past_exams" as ContentType, label: "Çıkmış Sorular", icon: ClipboardList, count: tabCounts.past_exams, tooltip: `${tabCounts.past_exams} sınav sorusu` },
    { value: "discussion" as ContentType, label: "Tartışmalar", icon: MessageSquare, count: tabCounts.discussion, tooltip: `${tabCounts.discussion} tartışma` },
    { value: "kaynaklar" as ContentType, label: "Kaynaklar", icon: BookMarked, count: tabCounts.kaynaklar, tooltip: `${tabCounts.kaynaklar} kaynak` },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-3 font-medium">
          <ArrowLeft className="h-4 w-4" /> Tüm Dersler
        </Link>

        {/* Course header + tabs fused together */}
        {course && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mb-0 overflow-hidden border-0 rounded-b-none" style={{ boxShadow: 'var(--shadow-elevated)' }}>
              <div className="gradient-hero px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {normalizeCourseCode(course.code) && (
                        <span className="text-xs font-bold tracking-wider uppercase text-primary-foreground/80">{normalizeCourseCode(course.code)}</span>
                      )}
                      {(course.year !== null && course.year !== undefined) && (
                        <span className="text-[10px] font-semibold bg-primary-foreground/15 px-2 py-0.5 rounded-full text-primary-foreground/90">
                          {course.year === 0 ? "Hazırlık" : `${course.year}. Sınıf`}
                        </span>
                      )}
                    </div>
                    <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-primary-foreground tracking-tight">{course.name}</h1>
                    <p className="text-xs text-primary-foreground/60 mt-0.5 font-medium">{course.department}</p>
                    {course.description && (
                      <p className="text-xs text-primary-foreground/50 mt-1.5 max-w-xl leading-relaxed">{course.description}</p>
                    )}
                  </div>
                  {/* Content creation dropdown — prominent in header */}
                  {canAddContent && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" className="gap-1.5 shrink-0 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0">
                          <Plus className="h-4 w-4" /> İçerik Ekle
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {CONTENT_ACTIONS.map((action) => {
                          const Icon = action.icon;
                          return (
                            <DropdownMenuItem key={action.type} onClick={() => {
                              if (action.type === "discussion") {
                                setActiveTab("discussion");
                              } else {
                                setCreateType(action.type);
                              }
                            }} className="gap-2 cursor-pointer">
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
            </Card>
          </motion.div>
        )}

        {/* Sticky tab bar — directly attached to header */}
        <div className="sticky top-[56px] z-30 -mx-4 px-4 mb-4">
          <div className="bg-card border border-t-0 border-border rounded-b-xl" style={{ boxShadow: 'var(--shadow-warm)' }}>
            <div className="flex items-stretch overflow-x-auto scrollbar-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.value;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`
                      relative flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-semibold transition-colors
                      ${isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                    <span className={`
                      ml-0.5 text-[11px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center
                      ${isActive ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}
                    `} title={tab.tooltip}>
                      {tab.count}
                    </span>
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

        {/* Main content + sticky sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
          {/* Main content — no wiki above, immediate content */}
          <div className="min-w-0 min-h-[400px]">
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
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <p className="text-xs text-muted-foreground font-medium">
                        {filteredPosts.length} {contentTypeLabel(activeTab)}
                      </p>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                        <SelectTrigger className="w-36 h-8 text-xs rounded-lg bg-secondary/50 border-transparent"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest"><span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> En Yeni</span></SelectItem>
                          <SelectItem value="most_voted"><span className="flex items-center gap-1.5"><ThumbsUp className="h-3 w-3" /> En Çok Oylanan</span></SelectItem>
                          <SelectItem value="most_downloaded"><span className="flex items-center gap-1.5"><Download className="h-3 w-3" /> En Çok İndirilen</span></SelectItem>
                          <SelectItem value="most_discussed"><span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> En Çok Tartışılan</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      {loading ? (
                        <div className="text-center py-12">
                          <div className="inline-block h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <p className="text-sm text-muted-foreground mt-2">Yükleniyor...</p>
                        </div>
                      ) : filteredPosts.length > 0 ? (
                        filteredPosts.map((post, i) => (
                          <motion.div key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: i * 0.03 }}>
                            <PostCard post={post} onVoted={fetchPosts} showAdminActions={isAdmin} />
                          </motion.div>
                        ))
                      ) : (
                        <div className="text-center py-14 bg-secondary/30 rounded-xl">
                          <p className="text-muted-foreground text-sm">Henüz {contentTypeLabel(activeTab)} yok.</p>
                          {canAddContent && <p className="text-sm mt-1.5 font-medium text-primary">İlk paylaşan siz olun!</p>}
                          {user && !canAddContent && <p className="text-xs mt-1.5 text-muted-foreground">Sadece kendi üniversitenizin derslerine içerik ekleyebilirsiniz.</p>}
                          {!user && <p className="text-sm mt-1.5"><Link to="/auth" className="text-primary font-semibold hover:underline">Giriş yapın</Link> paylaşmak için.</p>}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Sticky sidebar — hidden on mobile */}
          {id && (
            <aside className="hidden lg:block">
              <div className="sticky top-16 space-y-3 max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-none pb-4">
                <CourseResources courseId={id} />
                <TrendingDiscussions courseId={id} onSelect={handleTrendingSelect} />
                <RecentContent courseId={id} />
                <CourseWiki courseId={id} />
              </div>
            </aside>
          )}
        </div>

        {/* Mobile: sidebar cards below content */}
        {id && (
          <div className="lg:hidden space-y-3 mt-6">
            <CourseResources courseId={id} />
            <TrendingDiscussions courseId={id} onSelect={handleTrendingSelect} />
            <RecentContent courseId={id} />
            <CourseWiki courseId={id} />
          </div>
        )}
      </div>

      {/* Hidden CreatePostDialog triggered by dropdown */}
      {canAddContent && createType && id && (
        <CreatePostDialog
          courseId={id}
          defaultType={createType}
          onCreated={() => { fetchPosts(); setCreateType(null); }}
          externalOpen={true}
          onOpenChange={(open) => { if (!open) setCreateType(null); }}
        />
      )}
    </Layout>
  );
}
