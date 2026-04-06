import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Bell,
  BookMarked,
  BookOpen,
  Clock,
  FileText,
  GraduationCap,
  MessageSquare,
  Settings,
  Star,
  ThumbsUp,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import BadgeDisplay from "@/components/BadgeDisplay";
import { useBadges } from "@/hooks/useBadges";

type ProfileRow = Tables<"profiles">;
type BookmarkRow = Pick<Tables<"bookmarks">, "id" | "post_id" | "created_at">;
type PostRow = Pick<Tables<"posts">, "id" | "title" | "content_type" | "created_at" | "course_id">;
type CommentRow = Pick<Tables<"comments">, "id" | "content" | "post_id" | "created_at">;
type ActiveCourse = { id: string; name: string; contributionCount: number };
type BookmarkWithPost = BookmarkRow & { post: Pick<Tables<"posts">, "id" | "title" | "content_type"> | null };

type UserStats = {
  posts: number;
  votes: number;
  comments: number;
  notes: number;
  discussions: number;
  resources: number;
};

function ProfileStatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <Surface className="p-3 text-center" border="subtle">
      <div className="mb-1 flex items-center justify-center gap-1.5">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md bg-opacity-10 ${colorClass}`}>
          <Icon className={`h-3 w-3 ${colorClass}`} />
        </div>
      </div>
      <p className="text-lg font-extrabold tracking-tight">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
    </Surface>
  );
}

function SectionHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-heading text-base font-bold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    posts: 0,
    votes: 0,
    comments: 0,
    notes: 0,
    discussions: 0,
    resources: 0,
  });
  const [bookmarks, setBookmarks] = useState<BookmarkWithPost[]>([]);
  const [recentPosts, setRecentPosts] = useState<PostRow[]>([]);
  const [recentComments, setRecentComments] = useState<CommentRow[]>([]);
  const [activeCourses, setActiveCourses] = useState<ActiveCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(user.id), fetchUserStats(user.id), fetchBookmarks(user.id), fetchRecentActivity(user.id), fetchActiveCourses(user.id)]);
      setLoading(false);
    };

    void load();
  }, [user]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
    setProfile((data as ProfileRow | null) ?? null);
  };

  const fetchUserStats = async (userId: string) => {
    const [postsRes, votesRes, commentsRes, notesRes, discussionsRes, resourcesRes] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("votes").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("content_type", "notes"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("content_type", "discussion"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("content_type", "kaynaklar"),
    ]);

    setUserStats({
      posts: postsRes.count ?? 0,
      votes: votesRes.count ?? 0,
      comments: commentsRes.count ?? 0,
      notes: notesRes.count ?? 0,
      discussions: discussionsRes.count ?? 0,
      resources: resourcesRes.count ?? 0,
    });
  };

  const fetchBookmarks = async (userId: string) => {
    const { data: bookmarksData } = await supabase
      .from("bookmarks")
      .select("id, post_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const rows = (bookmarksData || []) as BookmarkRow[];
    if (!rows.length) {
      setBookmarks([]);
      return;
    }

    const postIds = rows.map((item) => item.post_id);
    const { data: postsData } = await supabase.from("posts").select("id, title, content_type").in("id", postIds);
    const postMap = new Map((postsData || []).map((item) => [item.id, item]));

    setBookmarks(
      rows.map((item) => ({
        ...item,
        post: postMap.get(item.post_id) ?? null,
      })),
    );
  };

  const fetchRecentActivity = async (userId: string) => {
    const [postsRes, commentsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, content_type, created_at, course_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("comments")
        .select("id, content, post_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    setRecentPosts((postsRes.data || []) as PostRow[]);
    setRecentComments((commentsRes.data || []) as CommentRow[]);
  };

  const fetchActiveCourses = async (userId: string) => {
    const { data: refs } = await supabase
      .from("posts")
      .select("course_id")
      .eq("user_id", userId)
      .not("course_id", "is", null)
      .limit(400);

    const entries = (refs || []) as { course_id: string | null }[];
    const validIds = entries.map((item) => item.course_id).filter((id): id is string => !!id);
    if (!validIds.length) {
      setActiveCourses([]);
      return;
    }

    const contributionCount = new Map<string, number>();
    for (const id of validIds) {
      contributionCount.set(id, (contributionCount.get(id) ?? 0) + 1);
    }

    const uniqueIds = Array.from(contributionCount.keys());
    const { data: coursesData } = await supabase.from("courses").select("id, name").in("id", uniqueIds);
    const coursesMap = new Map((coursesData || []).map((item) => [item.id, item.name]));

    const normalized = uniqueIds
      .map((id) => ({
        id,
        name: coursesMap.get(id) || "Ders",
        contributionCount: contributionCount.get(id) ?? 0,
      }))
      .sort((a, b) => b.contributionCount - a.contributionCount)
      .slice(0, 8);

    setActiveCourses(normalized);
  };

  const removeBookmark = async (bookmarkId: string) => {
    await supabase.from("bookmarks").delete().eq("id", bookmarkId);
    setBookmarks((prev) => prev.filter((item) => item.id !== bookmarkId));
  };

  const trustSignals = useMemo(() => {
    let value = 0;
    if (profile?.university) value += 1;
    if (profile?.department) value += 1;
    if (profile?.class_year) value += 1;
    if (profile?.bio) value += 1;
    return value;
  }, [profile]);

  if (authLoading || !user) return null;

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <StateBlock
            variant="loading"
            size="section"
            title="Profil hazırlanıyor"
            description="Kimlik ve katkı verileri yükleniyor."
          />
        </div>
      </Layout>
    );
  }

  const username = profile?.username || user.email || "Profil";
  const contentTypeIcon: Record<string, LucideIcon> = {
    notes: FileText,
    past_exams: BookOpen,
    discussion: MessageSquare,
    kaynaklar: BookMarked,
  };
  const contentTypeLabel: Record<string, string> = {
    notes: "Not",
    past_exams: "Çıkmış Soru",
    discussion: "Tartışma",
    kaynaklar: "Kaynak",
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <Surface variant="raised" border="subtle" padding="none" radius="xl" className="overflow-hidden border-border/70">
              <div className="h-28 gradient-hero" />
              <div className="px-6 pb-6">
                <div className="-mt-11 flex items-end gap-4">
                  <div className="relative">
                    <Avatar className="h-20 w-20 shrink-0 border-4 border-card" style={{ boxShadow: "var(--shadow-card)" }}>
                      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="Avatar" /> : null}
                      <AvatarFallback className="bg-primary font-heading text-2xl font-extrabold text-primary-foreground">
                        {username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-card bg-emerald-500" />
                  </div>

                  <div className="min-w-0 flex-1 pt-10">
                    <div className="flex items-center gap-2">
                      <h1 className="truncate font-heading text-xl font-extrabold">{profile?.username || "Profil"}</h1>
                      <Badge className="border-emerald-200 bg-emerald-500/10 text-xs text-emerald-500">Çevrimiçi</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto h-8 gap-1.5 text-xs font-semibold"
                        onClick={() => navigate("/settings")}
                        title="Ayarlar"
                      >
                        <Settings className="h-3.5 w-3.5" />
                        Ayarlar
                      </Button>
                    </div>

                    <AcademicMeta
                      size="sm"
                      tone="muted"
                      className="mt-1"
                      items={[
                        ...(profile?.university
                          ? [{ kind: "university" as const, label: "Üniversite", value: profile.university, emphasis: "subtle" as const }]
                          : []),
                        ...(profile?.department
                          ? [{ kind: "department" as const, label: "Bölüm", value: profile.department, emphasis: "subtle" as const }]
                          : []),
                        ...(profile?.class_year
                          ? [{ kind: "custom" as const, label: "Sınıf", value: `${profile.class_year}. Sınıf`, emphasis: "subtle" as const }]
                          : []),
                      ]}
                    />

                    {profile?.bio ? <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">{profile.bio}</p> : null}

                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                        <Star className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm font-bold text-primary">{profile?.reputation_points ?? 0} puan</span>
                    </div>
                    <OwnBadges />
                  </div>
                </div>

                <div className="mt-5 border-t border-border/60 pt-4">
                  <SectionHeader title="Katkı Özeti" description="Profildeki akademik hareketin genel görünümü" icon={TrendingUp} />
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <ProfileStatCard icon={FileText} label="Gönderi" value={userStats.posts} colorClass="text-primary" />
                    <ProfileStatCard icon={ThumbsUp} label="Oy" value={userStats.votes} colorClass="text-emerald-500" />
                    <ProfileStatCard icon={MessageSquare} label="Yorum" value={userStats.comments} colorClass="text-amber-500" />
                    <ProfileStatCard icon={BookOpen} label="Not" value={userStats.notes} colorClass="text-blue-500" />
                    <ProfileStatCard icon={GraduationCap} label="Tartışma" value={userStats.discussions} colorClass="text-purple-500" />
                    <ProfileStatCard icon={BookMarked} label="Kaynak" value={userStats.resources} colorClass="text-orange-500" />
                  </div>
                </div>
              </div>
            </Surface>

            <Tabs defaultValue="contributions" className="w-full">
              <Surface variant="soft" border="subtle" padding="sm" radius="xl">
                <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-secondary/70 p-1">
                  <TabsTrigger value="contributions" className="rounded-lg text-xs font-semibold">
                    Katkılar
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="rounded-lg text-xs font-semibold">
                    Kaydedilenler
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="rounded-lg text-xs font-semibold">
                    Son Aktivite
                  </TabsTrigger>
                </TabsList>
              </Surface>

              <TabsContent value="contributions" className="mt-3 space-y-2">
                <SectionHeader title="Katkılarım" description="Son paylaştığın içerikler" icon={FileText} />
                {recentPosts.length === 0 ? (
                  <StateBlock
                    variant="empty"
                    size="section"
                    title="Henüz katkı görünmüyor"
                    description="Bir derste not, kaynak veya tartışma paylaşarak başlayabilirsin."
                    primaryAction={
                      <Button asChild size="sm">
                        <Link to="/courses">Derslere Git</Link>
                      </Button>
                    }
                  />
                ) : (
                  recentPosts.map((item) => {
                    const Icon = contentTypeIcon[item.content_type || ""] || FileText;
                    return (
                      <Link key={item.id} to={`/post/${item.id}`}>
                        <Surface variant="soft" border="subtle" padding="sm" className="cursor-pointer transition-colors hover:border-primary/20">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{item.title || "Başlıksız içerik"}</p>
                              <p className="text-xs text-muted-foreground">
                                {contentTypeLabel[item.content_type || ""] || "İçerik"} ·{" "}
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}
                              </p>
                            </div>
                          </div>
                        </Surface>
                      </Link>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="saved" className="mt-3 space-y-2">
                <SectionHeader title="Kaydedilenler" description="Sonra dönmek için sakladığın içerikler" icon={BookMarked} />
                {bookmarks.length === 0 ? (
                  <StateBlock
                    variant="empty"
                    size="section"
                    title="Henüz kaydedilen içerik yok"
                    description="Kaydettiğin içerikler burada listelenecek."
                  />
                ) : (
                  bookmarks.map((item) => (
                    <Surface key={item.id} variant="soft" border="subtle" padding="sm" className="transition-colors hover:border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <BookMarked className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {item.post ? (
                            <Link to={`/post/${item.post.id}`} className="block truncate text-sm font-medium transition-colors hover:text-primary">
                              {item.post.title || "Başlıksız içerik"}
                            </Link>
                          ) : (
                            <span className="text-sm italic text-muted-foreground">Silinmiş içerik</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeBookmark(item.id)}
                          className="shrink-0 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
                        >
                          Kaldır
                        </button>
                      </div>
                    </Surface>
                  ))
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-3 space-y-2">
                <SectionHeader title="Son Aktivite" description="Yorum ve etkileşim akışın" icon={Clock} />
                {recentComments.length === 0 && recentPosts.length === 0 ? (
                  <StateBlock
                    variant="empty"
                    size="section"
                    title="Henüz aktivite yok"
                    description="Yorumların ve katkıların burada görünecek."
                  />
                ) : (
                  recentComments.slice(0, 8).map((item) => (
                    <Link key={item.id} to={`/post/${item.post_id}`}>
                      <Surface variant="soft" border="subtle" padding="sm" className="cursor-pointer transition-colors hover:border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-1 text-sm text-muted-foreground">{item.content}</p>
                            <p className="text-xs text-muted-foreground">
                              Yorum · {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}
                            </p>
                          </div>
                        </div>
                      </Surface>
                    </Link>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </div>

          <aside className="hidden space-y-3 lg:block">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Star className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-heading text-sm font-bold">Profil Rolü</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Bu ekran bir akademik güven kartıdır. Kimlik, ders bağlamı ve katkı geçmişi birlikte görünür.
              </p>
              <div className="mt-2 rounded-lg bg-secondary/50 px-2.5 py-2 text-[11px] text-muted-foreground">
                Güven sinyali: {trustSignals}/4 kimlik alanı dolu.
              </div>
            </Surface>

            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-heading text-sm font-bold">Aktif Dersler</h2>
              </div>
              {activeCourses.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">Henüz aktif ders sinyali yok.</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {activeCourses.map((course) => (
                    <Link key={course.id} to={`/course/${course.id}`}>
                      <Surface variant="soft" border="subtle" padding="sm" radius="lg" className="transition-colors hover:border-primary/30">
                        <p className="line-clamp-1 text-xs font-semibold">{course.name}</p>
                        <p className="text-[11px] text-muted-foreground">{course.contributionCount} katkı</p>
                      </Surface>
                    </Link>
                  ))}
                </div>
              )}
            </Surface>

            <Surface variant="soft" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Bell className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Hızlı Geçiş</p>
              </div>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/messages">Mesajlara Git</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/notifications">Bildirimleri Aç</Link>
                </Button>
                <Link to="/courses" className="block pt-1 text-center text-xs font-semibold text-primary hover:underline">
                  Derslere dön
                </Link>
              </div>
            </Surface>
          </aside>

          <div className="space-y-3 lg:hidden">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-sm font-bold">Hızlı Geçiş</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Profil akışından sonra mesajlara, bildirimlere veya ders bağlamına geçebilirsin.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/messages">Mesajlar</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/notifications">Bildirimler</Link>
                </Button>
              </div>
              <Button asChild size="sm" variant="ghost" className="mt-1 h-8 w-full">
                <Link to="/courses">Derslere Dön</Link>
              </Button>
            </Surface>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function OwnBadges() {
  const { badges, checkAndAwardBadges } = useBadges();

  useEffect(() => {
    checkAndAwardBadges();
  }, [checkAndAwardBadges]);

  if (!badges.length) return null;
  return (
    <div className="mt-1.5">
      <BadgeDisplay badges={badges} maxShow={6} size="sm" />
    </div>
  );
}
