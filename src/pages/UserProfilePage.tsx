import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, FileText, ThumbsUp, MessageSquare, Send, BookOpen, ClipboardList, BookMarked, Clock, GraduationCap, Users } from "lucide-react";
import { useIsUserOnline } from "@/hooks/useGlobalPresence";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import BadgeDisplay from "@/components/BadgeDisplay";
import FollowButton from "@/components/FollowButton";
import ReportDialog from "@/components/ReportDialog";
import { useBadges } from "@/hooks/useBadges";
import { useFollow } from "@/hooks/useFollow";

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

export default function UserProfilePage() {
  const { id: userId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [userStats, setUserStats] = useState({ posts: 0, votes: 0, comments: 0, notes: 0, discussions: 0, resources: 0 });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dmStatus, setDmStatus] = useState<"allowed" | "disabled">("allowed");

  const { followersCount, followingCount } = useFollow(userId);
  const isOnline = useIsUserOnline(userId);

  useEffect(() => {
    if (userId) { fetchProfile(); fetchStats(); fetchRecentPosts(); checkDmStatus(); }
  }, [userId]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").eq("user_id", userId!).maybeSingle();
    setProfile(data);
    setLoading(false);
  };

  const fetchStats = async () => {
    const [p, v, c, n, d, r] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("votes").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("content_type", "notes"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("content_type", "discussion"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", userId!).eq("content_type", "kaynaklar"),
    ]);
    setUserStats({ posts: p.count ?? 0, votes: v.count ?? 0, comments: c.count ?? 0, notes: n.count ?? 0, discussions: d.count ?? 0, resources: r.count ?? 0 });
  };

  const fetchRecentPosts = async () => {
    const { data } = await supabase.from("posts").select("id, title, content_type, created_at").eq("user_id", userId!).order("created_at", { ascending: false }).limit(5);
    setRecentPosts(data || []);
  };

  const checkDmStatus = async () => {
    if (!user || !userId || user.id === userId) return;

    const { data: blocked } = await supabase
      .from("blocked_users")
      .select("id")
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${user.id})`)
      .limit(1);
    if (blocked && blocked.length > 0) {
      setDmStatus("disabled");
      return;
    }

    const { data: settings } = await supabase.from("user_settings").select("dm_allowed").eq("user_id", userId).maybeSingle();
    if ((settings as any)?.dm_allowed === "nobody") {
      setDmStatus("disabled");
      return;
    }

    const { data: connection } = await supabase
      .from("connections")
      .select("id")
      .eq("status", "accepted")
      .or(`and(requester_id.eq.${user.id},target_id.eq.${userId}),and(requester_id.eq.${userId},target_id.eq.${user.id})`)
      .limit(1);
    if (!connection || connection.length === 0) {
      setDmStatus("disabled");
      return;
    }

    setDmStatus("allowed");
  };

  if (loading) {
    return <Layout><div className="container mx-auto px-4 py-16 text-center"><div className="inline-block h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div></Layout>;
  }

  if (!profile) {
    return <Layout><div className="container mx-auto px-4 py-16 text-center"><p className="text-muted-foreground">Kullanıcı bulunamadı.</p></div></Layout>;
  }

  const isOwnProfile = user?.id === userId;
  const contentTypeIcon: Record<string, typeof FileText> = { notes: FileText, past_exams: ClipboardList, discussion: MessageSquare, kaynaklar: BookMarked };
  const contentTypeLabel: Record<string, string> = { notes: "Not", past_exams: "Çıkmış Soru", discussion: "Tartışma", kaynaklar: "Kaynak" };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-0 overflow-hidden" style={{ boxShadow: 'var(--shadow-elevated)' }}>
            <div className="gradient-hero h-24" />
            <div className="px-6 pb-6">
              <div className="flex items-end gap-4 -mt-10">
                <div className="relative group">
                  <Avatar className="h-20 w-20 border-4 border-card shrink-0" style={{ boxShadow: 'var(--shadow-card)' }}>
                    {profile.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt={profile.username || "Avatar"} />
                    ) : null}
                    <AvatarFallback className="text-2xl font-heading font-extrabold bg-primary text-primary-foreground">
                      {(profile.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-card ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                  {user && !isOwnProfile && profile.avatar_url && (
                    <div className="absolute -bottom-1 -right-1">
                      <ReportDialog
                        targetType="user"
                        targetId={userId!}
                        trigger={
                          <button className="h-6 w-6 rounded-full bg-card border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive" title="Avatarı Bildir">
                            <span className="text-[10px]">⚑</span>
                          </button>
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pt-10">
                  <div className="flex items-center gap-2">
                    <h1 className="font-heading text-xl font-extrabold truncate">{profile.username || "Kullanıcı"}</h1>
                    <Badge className={`text-[10px] ${isOnline ? "bg-emerald-500/10 text-emerald-500 border-emerald-200" : "bg-muted text-muted-foreground"}`}>
                      {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    {profile.university && (
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{profile.university}</span>
                    )}
                    {profile.department && <span>· {profile.department}</span>}
                    {profile.class_year && <span>· {profile.class_year}. Sınıf</span>}
                  </div>
                  {profile.bio && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 italic">{profile.bio}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center">
                      <Star className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-primary">{profile.reputation_points ?? 0} puan</span>
                  </div>
                  <UserBadgesDisplay userId={userId!} />
                </div>
              </div>

              {/* Follower/Following counts */}
              <div className="flex items-center gap-4 mt-4 pt-3 border-t">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-bold">{followersCount}</span>
                  <span className="text-xs text-muted-foreground">Takipçi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold">{followingCount}</span>
                  <span className="text-xs text-muted-foreground">Takip</span>
                </div>
              </div>

              {/* Stats - Admin Panel Style */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 pt-3 border-t">
                <ProfileStatCard icon={FileText} label="Gönderi" value={userStats.posts} color="text-primary" />
                <ProfileStatCard icon={ThumbsUp} label="Oy" value={userStats.votes} color="text-emerald-500" />
                <ProfileStatCard icon={MessageSquare} label="Yorum" value={userStats.comments} color="text-amber-500" />
                <ProfileStatCard icon={BookOpen} label="Not" value={userStats.notes} color="text-blue-500" />
                <ProfileStatCard icon={ClipboardList} label="Tartışma" value={userStats.discussions} color="text-purple-500" />
                <ProfileStatCard icon={BookMarked} label="Kaynak" value={userStats.resources} color="text-orange-500" />
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-2 flex-wrap">
                {user && !isOwnProfile && (
                  <>
                    <FollowButton targetUserId={userId!} />
                    {dmStatus === "disabled" ? (
                      <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" disabled>
                        <Send className="h-3.5 w-3.5" /> DM Kapalı
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => navigate(`/messages?to=${userId}`)}>
                        <Send className="h-3.5 w-3.5" /> Mesaj Gönder
                      </Button>
                    )}
                  </>
                )}
                {isOwnProfile && (
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/settings")}>
                    Profili Düzenle
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Recent contributions */}
        {recentPosts.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
            <Card className="border-0" style={{ boxShadow: 'var(--shadow-elevated)' }}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Clock className="h-3 w-3 text-primary" />
                  </div>
                  <CardTitle className="text-sm font-bold">Son Katkılar</CardTitle>
                </div>
              </CardHeader>
              <div className="px-6 pb-4 space-y-2">
                {recentPosts.map((p) => {
                  const Icon = contentTypeIcon[p.content_type] || FileText;
                  return (
                    <Link key={p.id} to={`/post/${p.id}`}>
                      <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors cursor-pointer">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {contentTypeLabel[p.content_type]} · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: tr })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}

function UserBadgesDisplay({ userId }: { userId: string }) {
  const { badges } = useBadges(userId);
  if (!badges.length) return null;
  return (
    <div className="mt-1.5">
      <BadgeDisplay badges={badges} maxShow={6} size="sm" />
    </div>
  );
}
