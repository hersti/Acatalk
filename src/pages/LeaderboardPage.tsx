import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BadgeDisplay from "@/components/BadgeDisplay";
import { Trophy, Medal, Award, Search, Crown, Flame, TrendingUp, Users, Star } from "lucide-react";
import { Link } from "react-router-dom";

interface LeaderUser {
  id: string;
  user_id: string;
  username: string | null;
  university: string | null;
  department: string | null;
  reputation_points: number;
  avatar_url: string | null;
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-8 w-8 rounded-lg ${color} bg-opacity-10 flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
    </Card>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uniFilter, setUniFilter] = useState("all");
  const [universities, setUniversities] = useState<string[]>([]);
  const [badgeMap, setBadgeMap] = useState<Map<string, any[]>>(new Map());

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles").select("id, user_id, username, university, department, reputation_points, avatar_url")
      .order("reputation_points", { ascending: false }).limit(100);

    if (data) {
      setUsers(data as LeaderUser[]);
      const dbUnis = data.map(u => u.university).filter(Boolean) as string[];
      const allUnis = [...new Set(dbUnis)].sort((a, b) => a.localeCompare(b, "tr"));
      setUniversities(allUnis);

      const userIds = data.slice(0, 20).map(u => u.user_id);
      if (userIds.length > 0) {
        const { data: userBadges } = await supabase
          .from("user_badges").select("user_id, badge_id, earned_at, badges(key, name, description, category, icon)")
          .in("user_id", userIds);
        if (userBadges) {
          const map = new Map<string, any[]>();
          userBadges.forEach((ub: any) => {
            const arr = map.get(ub.user_id) || [];
            arr.push({ badge: ub.badges, earned_at: ub.earned_at });
            map.set(ub.user_id, arr);
          });
          setBadgeMap(map);
        }
      }
    }
    setLoading(false);
  };

  const filtered = users.filter(u => {
    if (uniFilter !== "all" && u.university !== uniFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (u.username || "").toLowerCase().includes(q) || (u.department || "").toLowerCase().includes(q);
    }
    return true;
  });

  const myRank = user ? users.findIndex(u => u.user_id === user.id) + 1 : 0;
  const topUser = users[0];

  const getRankDisplay = (index: number) => {
    if (index === 0) return <Crown className="h-5 w-5 text-gold" />;
    if (index === 1) return <Medal className="h-5 w-5 text-silver" />;
    if (index === 2) return <Award className="h-5 w-5 text-bronze" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-muted-foreground">{index + 1}</span>;
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* Header - Admin Panel Style */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-lg font-extrabold tracking-tight">Sıralama</h1>
            <p className="text-[11px] text-muted-foreground">En çok katkı sağlayan öğrenciler</p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <StatCard icon={Users} label="Toplam Üye" value={users.length} color="text-primary" />
          <StatCard icon={Star} label="En Yüksek Puan" value={topUser?.reputation_points ?? 0} color="text-amber-500" />
          {myRank > 0 ? (
            <StatCard icon={TrendingUp} label="Sıralamanız" value={`#${myRank}`} color="text-emerald-500" />
          ) : (
            <StatCard icon={TrendingUp} label="Sıralamanız" value="—" color="text-muted-foreground" />
          )}
        </div>

        {/* My rank banner */}
        {myRank > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
            <Card className="p-4 mb-4 border-primary/20 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">Sıralamanız: <span className="text-primary">#{myRank}</span></p>
                  <p className="text-[11px] text-muted-foreground">
                    {users.find(u => u.user_id === user?.id)?.reputation_points ?? 0} puan ile {users.length} kullanıcı arasında
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Filters - Admin Panel Style */}
        <Card className="p-3 mb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Kullanıcı veya bölüm ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={uniFilter} onValueChange={setUniFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Üniversite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Üniversiteler</SelectItem>
                {universities.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-[10px] shrink-0 self-center">{filtered.length} sonuç</Badge>
          </div>
        </Card>

        {/* Top 3 podium */}
        {filtered.length >= 3 && !search.trim() && uniFilter === "all" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-3 gap-2 mb-4">
            {[1, 0, 2].map(idx => {
              const u = filtered[idx];
              if (!u) return null;
              const heights = ["h-28", "h-36", "h-24"];
              const order = [1, 0, 2];
              return (
                <Link to={`/user/${u.user_id}`} key={u.id} className="flex flex-col items-center">
                  <Card className={`w-full flex flex-col items-center justify-end p-3 ${idx === 0 ? "border-gold/30 bg-gold/5" : ""} ${heights[order.indexOf(idx)]}`}>
                    <Avatar className={`${idx === 0 ? "h-12 w-12" : "h-10 w-10"} mb-1.5`}>
                      <AvatarFallback className={`font-bold text-sm ${idx === 0 ? "gradient-hero text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                        {(u.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {getRankDisplay(idx)}
                    <p className="font-heading font-bold text-xs mt-1 truncate max-w-full">{u.username || "Anonim"}</p>
                    <p className="text-primary font-extrabold text-sm">{u.reputation_points ?? 0}</p>
                  </Card>
                </Link>
              );
            })}
          </motion.div>
        )}

        {/* List */}
        <Card className="overflow-hidden" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <div className="p-1">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Flame className="h-6 w-6 text-muted-foreground/30 animate-pulse" />
              </div>
            ) : filtered.length > 0 ? filtered.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.5) }}
              >
                <Link to={`/user/${u.user_id}`}
                  className={`flex items-center gap-3 p-3.5 rounded-xl transition-colors ${i < 3 ? "bg-secondary/50" : "hover:bg-secondary/30"} ${i > 0 ? "mt-1" : ""} ${u.user_id === user?.id ? "ring-1 ring-primary/20" : ""}`}
                >
                  {getRankDisplay(i)}
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={`text-xs font-bold ${i === 0 ? "gradient-hero text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      {(u.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-heading font-bold text-sm truncate">{u.username || "Anonim"}</p>
                      {badgeMap.has(u.user_id) && (
                        <BadgeDisplay badges={badgeMap.get(u.user_id)!} maxShow={3} size="xs" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[u.university, u.department].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-heading font-extrabold text-lg text-primary">{u.reputation_points ?? 0}</span>
                    <p className="text-[10px] text-muted-foreground font-medium">puan</p>
                  </div>
                </Link>
              </motion.div>
            )) : (
              <div className="text-center py-12 rounded-lg bg-muted/30">
                <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">Sonuç bulunamadı</p>
                <p className="text-xs text-muted-foreground">Farklı filtrelerle tekrar deneyin.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
