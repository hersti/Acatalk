import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Star, FileText, ThumbsUp, MessageSquare, Bookmark, Trash2,
  BookOpen, ClipboardList, BookMarked, Clock, Settings, GraduationCap, Building2, TrendingUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import BadgeDisplay from "@/components/BadgeDisplay";
import { useBadges } from "@/hooks/useBadges";

/* ─── Stat Card ─── */
function ProfileStatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={`h-6 w-6 rounded-md ${color} bg-opacity-10 flex items-center justify-center`}>
          <Icon className={`h-3 w-3 ${color}`} />
        </div>
      </div>
      <p className="text-lg font-extrabold tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
    </Card>
  );
}

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState({ posts: 0, votes: 0, comments: 0, notes: 0, discussions: 0, resources: 0 });
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [recentComments, setRecentComments] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) { fetchProfile(); fetchUserStats(); fetchBookmarks(); fetchRecentActivity(); }
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
      posts: postsRes.count ?? 0, votes: votesRes.count ?? 0, comments: commentsRes.count ?? 0,
      notes: notesRes.count ?? 0, discussions: discussionsRes.count ?? 0, resources: resourcesRes.count ?? 0,
    });
  };

  const fetchBookmarks = async () => {
    if (!user) return;
    const { data: bmarks } = await supabase.from("bookmarks").select("id, post_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false });
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
      supabase.from("posts").select("id, title, content_type, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("comments").select("id, content, post_id, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
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
    notes: FileText, past_exams: ClipboardList, discussion: MessageSquare, kaynaklar: BookMarked,
  };
  const contentTypeLabel: Record<string, string> = {
    notes: "Not", past_exams: "Çıkmış Soru", discussion: "Tartışma", kaynaklar: "Kaynak",
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="overflow-hidden border-border/70 surface-panel">
            <div className="gradient-hero h-24" />
            <div className="px-6 pb-6">
              <div className="flex items-end gap-4 -mt-10">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-4 border-card shrink-0" style={{ boxShadow: 'var(--shadow-card)' }}>
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt="Avatar" />
                    ) : null}
                    <AvatarFallback className="text-2xl font-heading font-extrabold bg-primary text-primary-foreground">
                      {username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-card bg-emerald-500" />
                </div>
                <div className="flex-1 min-w-0 pt-10">
                  <div className="flex items-center gap-2">
                    <h1 className="font-heading text-xl font-extrabold truncate">{profile?.username || "Profil"}</h1>
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-200">Çevrimiçi</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 ml-auto" onClick={() => navigate("/settings")} title="Ayarlar">
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    {profile?.university && (
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{profile.university}</span>
                    )}
                    {profile?.department && <span>· {profile.department}</span>}
                    {profile?.class_year && <span>· {profile.class_year}. Sınıf</span>}
                  </div>
                  {profile?.bio && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 italic">{profile.bio}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center">
                      <Star className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-primary">{profile?.reputation_points ?? 0} puan</span>
                  </div>
                  <OwnBadges />
                </div>
              </div>

              {/* Stats row - Admin Panel Style */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-5 pt-4 border-t border-border/60">
                <ProfileStatCard icon={FileText} label="Gönderi" value={userStats.posts} color="text-primary" />
                <ProfileStatCard icon={ThumbsUp} label="Oy" value={userStats.votes} color="text-emerald-500" />
                <ProfileStatCard icon={MessageSquare} label="Yorum" value={userStats.comments} color="text-amber-500" />
                <ProfileStatCard icon={BookOpen} label="Not" value={userStats.notes} color="text-blue-500" />
                <ProfileStatCard icon={ClipboardList} label="Tartışma" value={userStats.discussions} color="text-purple-500" />
                <ProfileStatCard icon={BookMarked} label="Kaynak" value={userStats.resources} color="text-orange-500" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Profile Tabs */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
          <Tabs defaultValue="contributions" className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-11 bg-secondary/70 p-1 rounded-xl">
              <TabsTrigger value="contributions" className="text-xs font-semibold rounded-lg">Katkılarım</TabsTrigger>
              <TabsTrigger value="saved" className="text-xs font-semibold rounded-lg">Kaydedilenler</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs font-semibold rounded-lg">Son Aktivite</TabsTrigger>
            </TabsList>

            <TabsContent value="contributions" className="mt-3 space-y-2">
              {recentPosts.length === 0 ? (
                <div className="text-center py-10 bg-secondary/30 rounded-xl">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Henüz katkı yok.</p>
                  <p className="text-xs text-muted-foreground mt-1">Bir derse not, kaynak veya tartışma ekleyerek başlayın.</p>
                </div>
              ) : (
                recentPosts.map((p) => {
                  const Icon = contentTypeIcon[p.content_type] || FileText;
                  return (
                    <Link key={p.id} to={`/post/${p.id}`}>
                      <Card className="p-3 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer surface-soft">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {contentTypeLabel[p.content_type]} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: tr })}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="saved" className="mt-3 space-y-2">
              {bookmarks.length === 0 ? (
                <div className="text-center py-10 bg-secondary/30 rounded-xl">
                  <Bookmark className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Henüz kayıtlı içerik yok.</p>
                </div>
              ) : (
                bookmarks.map((b) => (
                  <Card key={b.id} className="p-3 hover:border-primary/20 transition-all surface-soft">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Bookmark className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {b.post ? (
                          <Link to={`/post/${b.post.id}`} className="text-sm font-medium hover:text-primary transition-colors truncate block">{b.post.title}</Link>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Silinen içerik</span>
                        )}
                      </div>
                      <button onClick={() => removeBookmark(b.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-3 space-y-2">
              {recentComments.length === 0 && recentPosts.length === 0 ? (
                <div className="text-center py-10 bg-secondary/30 rounded-xl">
                  <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Henüz aktivite yok.</p>
                </div>
              ) : (
                recentComments.slice(0, 8).map((c) => (
                  <Link key={c.id} to={`/post/${c.post_id}`}>
                    <Card className="p-3 hover:border-primary/20 hover:shadow-sm transition-all cursor-pointer surface-soft">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <MessageSquare className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-muted-foreground line-clamp-1">{c.content}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Yorum · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: tr })}
                          </p>
                        </div>
                      </div>
                    </Card>
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
  }, []);

  if (!badges.length) return null;
  return (
    <div className="mt-1.5">
      <BadgeDisplay badges={badges} maxShow={6} size="sm" />
    </div>
  );
}
