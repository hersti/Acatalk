import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  BookMarked,
  BookOpen,
  Clock,
  FileText,
  GraduationCap,
  MessageSquare,
  Send,
  Star,
  ThumbsUp,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import BadgeDisplay from "@/components/BadgeDisplay";
import FollowButton from "@/components/FollowButton";
import ReportDialog from "@/components/ReportDialog";
import { useBadges } from "@/hooks/useBadges";
import { useFollow } from "@/hooks/useFollow";
import { useIsUserOnline } from "@/hooks/useGlobalPresence";

type ProfileRow = Tables<"profiles">;
type PostRow = Pick<Tables<"posts">, "id" | "title" | "content_type" | "created_at" | "course_id">;
type ActiveCourse = { id: string; name: string; contributionCount: number };

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

export default function UserProfilePage() {
  const { id: userId } = useParams<{ id: string }>();
  const profileUserId = userId ?? "";
  const { user } = useAuth();
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
  const [recentPosts, setRecentPosts] = useState<PostRow[]>([]);
  const [activeCourses, setActiveCourses] = useState<ActiveCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dmStatus, setDmStatus] = useState<"allowed" | "disabled">("allowed");

  const { followersCount, followingCount } = useFollow(profileUserId);
  const isOnline = useIsUserOnline(profileUserId);

  useEffect(() => {
    if (!profileUserId) return;

    const load = async () => {
      setLoading(true);
      await Promise.all([
        fetchProfile(profileUserId),
        fetchStats(profileUserId),
        fetchRecentPosts(profileUserId),
        fetchActiveCourses(profileUserId),
      ]);
      setLoading(false);
    };

    void load();
  }, [profileUserId]);

  const fetchProfile = async (targetUserId: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", targetUserId).maybeSingle();
    setProfile((data as ProfileRow | null) ?? null);
  };

  const fetchStats = async (targetUserId: string) => {
    const [posts, votes, comments, notes, discussions, resources] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
      supabase.from("votes").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
      supabase.from("comments").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", targetUserId).eq("content_type", "notes"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", targetUserId).eq("content_type", "discussion"),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", targetUserId).eq("content_type", "kaynaklar"),
    ]);

    setUserStats({
      posts: posts.count ?? 0,
      votes: votes.count ?? 0,
      comments: comments.count ?? 0,
      notes: notes.count ?? 0,
      discussions: discussions.count ?? 0,
      resources: resources.count ?? 0,
    });
  };

  const fetchRecentPosts = async (targetUserId: string) => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, content_type, created_at, course_id")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(8);
    setRecentPosts((data || []) as PostRow[]);
  };

  const fetchActiveCourses = async (targetUserId: string) => {
    const { data: refs } = await supabase
      .from("posts")
      .select("course_id")
      .eq("user_id", targetUserId)
      .not("course_id", "is", null)
      .limit(400);

    const entries = (refs || []) as { course_id: string | null }[];
    const validIds = entries.map((item) => item.course_id).filter((id): id is string => !!id);

    if (!validIds.length) {
      setActiveCourses([]);
      return;
    }

    const countMap = new Map<string, number>();
    for (const id of validIds) {
      countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }

    const uniqueIds = Array.from(countMap.keys());
    const { data: coursesData } = await supabase.from("courses").select("id, name").in("id", uniqueIds);
    const coursesMap = new Map((coursesData || []).map((item) => [item.id, item.name]));

    const normalized = uniqueIds
      .map((id) => ({
        id,
        name: coursesMap.get(id) || "Ders",
        contributionCount: countMap.get(id) ?? 0,
      }))
      .sort((a, b) => b.contributionCount - a.contributionCount)
      .slice(0, 8);

    setActiveCourses(normalized);
  };

  const checkDmStatus = useCallback(async (targetUserId: string) => {
    if (!user || user.id === targetUserId) {
      setDmStatus("allowed");
      return;
    }

    const { data: blocked } = await supabase
      .from("blocked_users")
      .select("id")
      .or(
        `and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`,
      )
      .limit(1);
    if (blocked && blocked.length > 0) {
      setDmStatus("disabled");
      return;
    }

    const { data: settings } = await supabase
      .from("user_settings")
      .select("dm_allowed, dnd_mode")
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (settings?.dm_allowed === "nobody" || settings?.dnd_mode === true) {
      setDmStatus("disabled");
      return;
    }

    const { data: connection } = await supabase
      .from("connections")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${user.id},target_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},target_id.eq.${user.id})`,
      )
      .limit(1);
    if (!connection || connection.length === 0) {
      setDmStatus("disabled");
      return;
    }

    setDmStatus("allowed");
  }, [user]);

  useEffect(() => {
    if (!profileUserId || !user) return;
    void checkDmStatus(profileUserId);
  }, [checkDmStatus, profileUserId, user]);

  const trustSignals = useMemo(() => {
    let value = 0;
    if (profile?.university) value += 1;
    if (profile?.department) value += 1;
    if (profile?.class_year) value += 1;
    if (recentPosts.length > 0) value += 1;
    return value;
  }, [profile, recentPosts.length]);

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <StateBlock variant="loading" size="section" title="Profil yükleniyor" description="Kullanıcı bilgileri hazırlanıyor." />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
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

  const isOwnProfile = user?.id === profileUserId;
  const contentTypeIcon: Record<string, LucideIcon> = {
    notes: FileText,
    past_exams: BookOpen,
    discussion: MessageSquare,
    kaynaklar: BookMarked,
  };
  const contentTypeLabel: Record<string, string> = {
    notes: "Not",
    past_exams: "Geçmiş Sınav",
    discussion: "Tartışma",
    kaynaklar: "Kaynak",
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <Surface variant="raised" border="subtle" padding="none" radius="xl" className="overflow-hidden">
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
                    {user && !isOwnProfile ? (
                      <div className="absolute -bottom-1 -right-1">
                        <ReportDialog
                          targetType="user"
                          targetId={profileUserId}
                          trigger={
                            <button
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive group-hover:opacity-100"
                              title="Avatarı bildir"
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
                      <Badge
                        className={`text-xs ${
                          isOnline ? "border-emerald-200 bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                        }`}
                      >
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
                    <UserBadgesDisplay userId={profileUserId} />
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
                  <SectionHeader title="Katkı Özeti" description="Kullanıcının akademik içerik ve etkileşim görünümü" icon={TrendingUp} />
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <ProfileStatCard icon={FileText} label="Gönderi" value={userStats.posts} colorClass="text-primary" />
                    <ProfileStatCard icon={ThumbsUp} label="Oy" value={userStats.votes} colorClass="text-emerald-500" />
                    <ProfileStatCard icon={MessageSquare} label="Yorum" value={userStats.comments} colorClass="text-amber-500" />
                    <ProfileStatCard icon={BookOpen} label="Not" value={userStats.notes} colorClass="text-blue-500" />
                    <ProfileStatCard icon={GraduationCap} label="Tartışma" value={userStats.discussions} colorClass="text-purple-500" />
                    <ProfileStatCard icon={BookMarked} label="Kaynak" value={userStats.resources} colorClass="text-orange-500" />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {user && !isOwnProfile ? (
                    <>
                      <FollowButton targetUserId={profileUserId} />
                      {dmStatus === "disabled" ? (
                        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" disabled>
                          <Send className="h-3.5 w-3.5" /> DM Kapalı
                        </Button>
                      ) : (
                        <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => navigate(`/messages?to=${profileUserId}`)}>
                          <Send className="h-3.5 w-3.5" /> Mesaj Gönder
                        </Button>
                      )}
                    </>
                  ) : null}

                  {isOwnProfile ? (
                    <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={() => navigate("/settings")}>
                      Profili Düzenle
                    </Button>
                  ) : null}
                </div>
              </div>
            </Surface>

            <Surface variant="raised" border="subtle" padding="md" radius="xl">
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
                  {recentPosts.map((item) => {
                    const Icon = contentTypeIcon[item.content_type || ""] || FileText;
                    return (
                      <Link key={item.id} to={`/post/${item.id}`}>
                        <Surface variant="soft" border="subtle" padding="sm" className="cursor-pointer transition-colors hover:border-primary/20">
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                              <Icon className="h-3.5 w-3.5 text-primary" />
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
                  })}
                </div>
              )}
            </Surface>
          </div>

          <aside className="hidden space-y-3 lg:block">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <UserPlus className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-heading text-sm font-bold">Profil Rolü</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Bu ekran, kullanıcının akademik güven sinyallerini ve katkı tutarlılığını gösteren karttır.
              </p>
              <div className="mt-2 rounded-lg bg-secondary/50 px-2.5 py-2 text-[11px] text-muted-foreground">
                Güven sinyali: {trustSignals}/4
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
                <p className="mt-2 text-xs text-muted-foreground">Henüz aktif ders sinyali görünmüyor.</p>
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
                <MessageSquare className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Bağlama Dönüş</p>
              </div>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/courses">Derslere Git</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/notifications">Bildirimleri Aç</Link>
                </Button>
                {user && !isOwnProfile && dmStatus === "allowed" ? (
                  <Button asChild size="sm" variant="outline" className="h-8 w-full">
                    <Link to={`/messages?to=${profileUserId}`}>DM Başlat</Link>
                  </Button>
                ) : null}
              </div>
            </Surface>
          </aside>

          <div className="space-y-3 lg:hidden">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-sm font-bold">Bağlamlı Geçiş</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Bu profilden sonra ders bağlamına dönebilir veya gerekiyorsa DM başlatabilirsin.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/courses">Dersler</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/notifications">Bildirimler</Link>
                </Button>
              </div>
              {user && !isOwnProfile && dmStatus === "allowed" ? (
                <Button asChild size="sm" variant="ghost" className="mt-1 h-8 w-full">
                  <Link to={`/messages?to=${profileUserId}`}>DM Başlat</Link>
                </Button>
              ) : null}
            </Surface>
          </div>
        </div>
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
