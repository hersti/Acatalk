import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  Star,
  FileText,
  ThumbsUp,
  MessageSquare,
  Send,
  BookOpen,
  ClipboardList,
  BookMarked,
  Clock,
  Users,
  TrendingUp,
} from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import { useIsUserOnline } from "@/hooks/useGlobalPresence";
import BadgeDisplay from "@/components/BadgeDisplay";
import FollowButton from "@/components/FollowButton";
import ReportDialog from "@/components/ReportDialog";
import { useBadges } from "@/hooks/useBadges";
import { useFollow } from "@/hooks/useFollow";

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

export default function UserProfilePage() {
  const { id: userId } = useParams<{ id: string }>();
  const { user } = useAuth();
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
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dmStatus, setDmStatus] = useState<"allowed" | "disabled">("allowed");

  const { followersCount, followingCount } = useFollow(userId);
  const isOnline = useIsUserOnline(userId);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchStats();
      fetchRecentPosts();
      checkDmStatus();
    }
  }, [userId, user]);

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
    setUserStats({
      posts: p.count ?? 0,
      votes: v.count ?? 0,
      comments: c.count ?? 0,
      notes: n.count ?? 0,
      discussions: d.count ?? 0,
      resources: r.count ?? 0,
    });
  };

  const fetchRecentPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, content_type, created_at")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(5);
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
    return (
      <Layout>
        <div className="container mx-auto max-w-3xl px-4 py-12">
          <StateBlock variant="loading" size="section" title="Profil yükleniyor" description="Kullanıcı bilgileri hazırlanıyor." />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="container mx-auto max-w-3xl px-4 py-12">
          <StateBlock
            variant="noResults"
            size="section"
            title="Kullanıcı bulunamadı"
            description="Profil kaldırılmış olabilir veya bağlantı geçersiz olabilir."
          />
        </div>
      </Layout>
    );
  }

  const isOwnProfile = user?.id === userId;
  const contentTypeIcon: Record<string, typeof FileText> = {
    notes: FileText,
    past_exams: ClipboardList,
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
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Surface className="overflow-hidden" variant="raised" border="none" padding="none" radius="xl">
            <div className="h-28 gradient-hero" />
            <div className="px-6 pb-6">
              <div className="-mt-11 flex items-end gap-4">
                <div className="group relative">
                  <Avatar className="h-20 w-20 shrink-0 border-4 border-card" style={{ boxShadow: "var(--shadow-card)" }}>
                    {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt={profile.username || "Avatar"} /> : null}
                    <AvatarFallback className="bg-primary font-heading text-2xl font-extrabold text-primary-foreground">
                      {(profile.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-card ${
                      isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`}
                  />
                  {user && !isOwnProfile && profile.avatar_url ? (
                    <div className="absolute -bottom-1 -right-1">
                      <ReportDialog
                        targetType="user"
                        targetId={userId!}
                        trigger={
                          <button
                            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                            title="Avatarı Bildir"
                          >
          <span className="text-xs">!</span>
                          </button>
                        }
                      />
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1 pt-10">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate font-heading text-xl font-extrabold">{profile.username || "Kullanıcı"}</h1>
                    <Badge className={`text-xs ${isOnline ? "border-emerald-200 bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                      {isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                    </Badge>
                  </div>

                  <AcademicMeta
                    size="sm"
                    tone="muted"
                    className="mt-1"
                    items={[
                      ...(profile.university
                        ? [{ kind: "university" as const, label: "Üniversite", value: profile.university, emphasis: "subtle" as const }]
                        : []),
                      ...(profile.department
                        ? [{ kind: "department" as const, label: "Bölüm", value: profile.department, emphasis: "subtle" as const }]
                        : []),
                      ...(profile.class_year
                        ? [{ kind: "custom" as const, label: "Sınıf", value: `${profile.class_year}. Sınıf`, emphasis: "subtle" as const }]
                        : []),
                    ]}
                  />

                  {profile.bio ? <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">{profile.bio}</p> : null}

                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
                      <Star className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-primary">{profile.reputation_points ?? 0} puan</span>
                  </div>
                  <UserBadgesDisplay userId={userId!} />
                </div>
              </div>

              <div className="mt-4 border-t pt-3">
                <div className="flex flex-wrap items-center gap-4">
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
              </div>

              <div className="mt-4 border-t border-border/60 pt-4">
                <SectionHeader title="Profil İstatistikleri" description="Kullanıcının içerik ve etkileşim özetleri" icon={TrendingUp} />
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <ProfileStatCard icon={FileText} label="Gönderi" value={userStats.posts} color="text-primary" />
                  <ProfileStatCard icon={ThumbsUp} label="Oy" value={userStats.votes} color="text-emerald-500" />
                  <ProfileStatCard icon={MessageSquare} label="Yorum" value={userStats.comments} color="text-amber-500" />
                  <ProfileStatCard icon={BookOpen} label="Not" value={userStats.notes} color="text-blue-500" />
                  <ProfileStatCard icon={ClipboardList} label="Tartışma" value={userStats.discussions} color="text-purple-500" />
                  <ProfileStatCard icon={BookMarked} label="Kaynak" value={userStats.resources} color="text-orange-500" />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {user && !isOwnProfile ? (
                  <>
                    <FollowButton targetUserId={userId!} />
                    {dmStatus === "disabled" ? (
                      <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" disabled>
                        <Send className="h-3.5 w-3.5" /> DM Kapalı
                      </Button>
                    ) : (
                      <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => navigate(`/messages?to=${userId}`)}>
                        <Send className="h-3.5 w-3.5" /> Mesaj Gönder
                      </Button>
                    )}
                  </>
                ) : null}

                {isOwnProfile ? (
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/settings")}>
                    Profili Düzenle
                  </Button>
                ) : null}
              </div>
            </div>
          </Surface>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
          <Surface variant="raised" border="none" padding="md" radius="xl">
            <SectionHeader title="Son Katkılar" description="Kullanıcının son paylaştığı içerikler" icon={Clock} />
            {recentPosts.length === 0 ? (
              <StateBlock
                variant="empty"
                size="inline"
                title="Henüz gösterilecek katkı yok"
                description="Yeni paylaşımlar yapıldığında burada listelenecek."
              />
            ) : (
              <div className="space-y-2">
                {recentPosts.map((p) => {
                  const Icon = contentTypeIcon[p.content_type] || FileText;
                  return (
                    <Link key={p.id} to={`/post/${p.id}`}>
                      <Surface variant="soft" border="subtle" padding="sm" className="cursor-pointer transition-colors hover:border-primary/20">
                        <div className="flex items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                            <Icon className="h-3.5 w-3.5 text-primary" />
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
                })}
              </div>
            )}
          </Surface>
        </motion.div>
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
