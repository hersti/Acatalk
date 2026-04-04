import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Star,
  FileText,
  ThumbsUp,
  MessageSquare,
  Bookmark,
  Trash2,
  BookOpen,
  ClipboardList,
  BookMarked,
  Clock,
  Settings,
  TrendingUp,
} from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import BadgeDisplay from "@/components/BadgeDisplay";
import { useBadges } from "@/hooks/useBadges";

function ProfileStatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Surface className="p-3 text-center" border="subtle">
      <div className="mb-1 flex items-center justify-center gap-1.5">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${color} bg-opacity-10`}>
          <Icon className={`h-3 w-3 ${color}`} />
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
  icon: any;
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
  const [profile, setProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState({
    posts: 0,
    votes: 0,
    comments: 0,
    notes: 0,
    discussions: 0,
    resources: 0,
  });
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [recentComments, setRecentComments] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchUserStats();
      fetchBookmarks();
      fetchRecentActivity();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
    if (data) setProfile(data);
  };

  const fetchUserStats = async () => {
    const [postsRes, votesRes, commentsRes, notesRes, discussionsRes, resourcesRes] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("votes").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("content_type", "notes"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("content_type", "discussion"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("content_type", "kaynaklar"),
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

  const fetchBookmarks = async () => {
    if (!user) return;
    const { data: bmarks } = await supabase
      .from("bookmarks")
      .select("id, post_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (bmarks && bmarks.length > 0) {
      const postIds = bmarks.map((b: any) => b.post_id);
      const { data: posts } = await supabase.from("posts").select("id, title, content_type").in("id", postIds);
      const postMap = new Map(posts?.map((p) => [p.id, p]) || []);
      setBookmarks(bmarks.map((b: any) => ({ ...b, post: postMap.get(b.post_id) || null })));
    } else {
      setBookmarks([]);
    }
  };

  const fetchRecentActivity = async () => {
    if (!user) return;
    const [postsRes, commentsRes] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, content_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("comments")
        .select("id, content, post_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    setRecentPosts(postsRes.data || []);
    setRecentComments(commentsRes.data || []);
  };

  const removeBookmark = async (bookmarkId: string) => {
    await supabase.from("bookmarks").delete().eq("id", bookmarkId);
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
  };

  if (authLoading) return null;

  const username = profile?.username || user?.email || "?";
  const contentTypeIcon: Record<string, typeof FileText> = {
    notes: FileText,
    past_exams: ClipboardList,
    discussion: MessageSquare,
    kaynaklar: BookMarked,
  };
  const contentTypeLabel: Record<string, string> = {
    notes: "Not",
    past_exams: "Cikmis Soru",
    discussion: "Tartisma",
    kaynaklar: "Kaynak",
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Surface className="overflow-hidden border-border/70" variant="raised" border="subtle" padding="none" radius="xl">
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
                <SectionHeader title="Profil İstatistikleri" description="Katkılarınızın genel görünümü" icon={TrendingUp} />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <ProfileStatCard icon={FileText} label="Gönderi" value={userStats.posts} color="text-primary" />
                  <ProfileStatCard icon={ThumbsUp} label="Oy" value={userStats.votes} color="text-emerald-500" />
                  <ProfileStatCard icon={MessageSquare} label="Yorum" value={userStats.comments} color="text-amber-500" />
                  <ProfileStatCard icon={BookOpen} label="Not" value={userStats.notes} color="text-blue-500" />
                  <ProfileStatCard icon={ClipboardList} label="Tartışma" value={userStats.discussions} color="text-purple-500" />
                  <ProfileStatCard icon={BookMarked} label="Kaynak" value={userStats.resources} color="text-orange-500" />
                </div>
              </div>
            </div>
          </Surface>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
          <Tabs defaultValue="contributions" className="w-full">
            <Surface variant="soft" border="subtle" padding="sm" radius="xl">
              <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-secondary/70 p-1">
                <TabsTrigger value="contributions" className="rounded-lg text-xs font-semibold">Katkılarım</TabsTrigger>
                <TabsTrigger value="saved" className="rounded-lg text-xs font-semibold">Kaydedilenler</TabsTrigger>
                <TabsTrigger value="activity" className="rounded-lg text-xs font-semibold">Son Aktivite</TabsTrigger>
              </TabsList>
            </Surface>

            <TabsContent value="contributions" className="mt-3 space-y-2">
              <SectionHeader title="Katkılarım" description="Paylaştığınız son içerikler" icon={FileText} />
              {recentPosts.length === 0 ? (
                <StateBlock
                  variant="empty"
                  size="section"
                  icon={<FileText className="h-5 w-5" />}
                  title="Henüz katkı yok"
                  description="Bir derse not, kaynak veya tartışma ekleyerek başlayın."
                />
              ) : (
                recentPosts.map((p) => {
                  const Icon = contentTypeIcon[p.content_type] || FileText;
                  return (
                    <Link key={p.id} to={`/post/${p.id}`}>
                      <Surface variant="soft" border="subtle" padding="sm" className="cursor-pointer transition-all hover:border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {contentTypeLabel[p.content_type]} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: tr })}
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
              <SectionHeader title="Kaydedilenler" description="Daha sonra bakmak için sakladığınız içerikler" icon={Bookmark} />
              {bookmarks.length === 0 ? (
                <StateBlock
                  variant="empty"
                  size="section"
                  icon={<Bookmark className="h-5 w-5" />}
                  title="Henüz kayıtlı içerik yok"
                  description="Kaydettiğiniz içerikler burada listelenecek."
                />
              ) : (
                bookmarks.map((b) => (
                  <Surface key={b.id} variant="soft" border="subtle" padding="sm" className="transition-all hover:border-primary/20">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Bookmark className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {b.post ? (
                          <Link to={`/post/${b.post.id}`} className="block truncate text-sm font-medium transition-colors hover:text-primary">
                            {b.post.title}
                          </Link>
                        ) : (
                          <span className="text-sm italic text-muted-foreground">Silinen içerik</span>
                        )}
                      </div>
                      <button onClick={() => removeBookmark(b.id)} className="shrink-0 text-muted-foreground transition-colors hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Surface>
                ))
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-3 space-y-2">
              <SectionHeader title="Son Aktivite" description="Yorumlar ve son etkileşimler" icon={Clock} />
              {recentComments.length === 0 && recentPosts.length === 0 ? (
                <StateBlock
                  variant="empty"
                  size="section"
                  icon={<Clock className="h-5 w-5" />}
                  title="Henüz aktivite yok"
                  description="Yorum ve katkılarınız burada görünecek."
                />
              ) : (
                recentComments.slice(0, 8).map((c) => (
                  <Link key={c.id} to={`/post/${c.post_id}`}>
                    <Surface variant="soft" border="subtle" padding="sm" className="cursor-pointer transition-all hover:border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm text-muted-foreground">{c.content}</p>
                          <p className="text-xs text-muted-foreground">
                            Yorum · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: tr })}
                          </p>
                        </div>
                      </div>
                    </Surface>
                  </Link>
                ))
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
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
