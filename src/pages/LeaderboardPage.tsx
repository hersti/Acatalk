import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, Crown, Flame, Medal, Search, Star, TrendingUp, Trophy, Users } from "lucide-react";

import Layout from "@/components/Layout";
import BadgeDisplay from "@/components/BadgeDisplay";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AppPageHeader,
  MetricCard,
  PageTabsBar,
  ProductCard,
  ProductEmptyState,
} from "@/components/ui/product";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import {
  fetchUniversitiesCatalog,
  formatUniversityMetaLabel,
  type UniversityCatalogRow,
} from "@/lib/academic-catalog";

interface LeaderUser {
  id: string;
  user_id: string;
  username: string | null;
  university: string | null;
  department: string | null;
  reputation_points: number;
  avatar_url: string | null;
}

type BadgePayload = {
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
};

type BadgeEntry = {
  badge: BadgePayload | null;
  earned_at: string | null;
};

export default function LeaderboardPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState<LeaderUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uniFilter, setUniFilter] = useState("all");
  const [universities, setUniversities] = useState<string[]>([]);
  const [universityCatalog, setUniversityCatalog] = useState<UniversityCatalogRow[]>([]);
  const [badgeMap, setBadgeMap] = useState<Map<string, BadgeEntry[]>>(new Map());
  const [period, setPeriod] = useState<"all" | "monthly" | "weekly">("all");

  const universityCatalogByName = useMemo(() => {
    const map = new Map<string, UniversityCatalogRow>();
    for (const row of universityCatalog) {
      if (row?.name) map.set(row.name, row);
    }
    return map;
  }, [universityCatalog]);

  const getUniversityMetaLabel = (universityName: string | null | undefined) => {
    const name = String(universityName || "").trim();
    if (!name) return "Tür bilgisi yok";
    const row = universityCatalogByName.get(name);
    return formatUniversityMetaLabel({
      city: row?.city || null,
      type: row?.type || null,
    });
  };

  useEffect(() => {
    void fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    setLoading(true);

    const [{ data }, catalogRows] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id, username, university, department, reputation_points, avatar_url")
        .order("reputation_points", { ascending: false })
        .limit(100),
      fetchUniversitiesCatalog().catch(() => [] as UniversityCatalogRow[]),
    ]);

    setUniversityCatalog(catalogRows);

    if (!data) {
      setUsers([]);
      setUniversities([]);
      setBadgeMap(new Map());
      setLoading(false);
      return;
    }

    setUsers(data as LeaderUser[]);

    const dbUnis = data.map((item) => item.university).filter(Boolean) as string[];
    setUniversities([...new Set(dbUnis)].sort((a, b) => a.localeCompare(b, "tr")));

    const userIds = data.slice(0, 20).map((item) => item.user_id);
    if (userIds.length > 0) {
      const { data: userBadges } = await supabase
        .from("user_badges")
        .select("user_id, badge_id, earned_at, badges(key, name, description, category, icon)")
        .in("user_id", userIds);

      if (userBadges) {
        const map = new Map<string, BadgeEntry[]>();

        userBadges.forEach((entry) => {
          const rows = map.get(entry.user_id) || [];
          rows.push({
            badge: (entry.badges as BadgePayload | null) ?? null,
            earned_at: entry.earned_at ?? null,
          });
          map.set(entry.user_id, rows);
        });

        setBadgeMap(map);
      }
    }

    setLoading(false);
  };

  const filtered = users.filter((item) => {
    if (uniFilter !== "all" && item.university !== uniFilter) return false;

    if (search.trim()) {
      const q = search.toLocaleLowerCase("tr-TR");
      return (
        (item.username || "").toLocaleLowerCase("tr-TR").includes(q) ||
        (item.department || "").toLocaleLowerCase("tr-TR").includes(q)
      );
    }

    return true;
  });

  const periodScoped = useMemo(() => {
    return filtered;
  }, [filtered]);

  const myRank = user ? users.findIndex((item) => item.user_id === user.id) + 1 : 0;
  const topUser = users[0];

  const tabItems = [
    { key: "all", label: "Tüm Zamanlar", count: periodScoped.length },
    { key: "monthly", label: "Bu Ay", count: periodScoped.length },
    { key: "weekly", label: "Bu Hafta", count: periodScoped.length },
  ];

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <AppPageHeader
          title="Liderlik"
          description="Katkı yoğunluğu en yüksek öğrencileri karşılaştır, profil güven sinyallerini tek görünümde takip et."
          icon={<Trophy className="h-5 w-5" />}
          actions={<Badge variant="secondary" className="h-9 rounded-xl px-3 text-xs">{periodScoped.length} kayıt</Badge>}
          tabs={
            <div className="space-y-2">
              <PageTabsBar value={period} onChange={(next) => setPeriod(next as typeof period)} items={tabItems} />
              {(period === "monthly" || period === "weekly") ? (
                <p className="px-1 text-[11px] text-muted-foreground">
                  Dönemsel puan geçmişi mevcut şemada olmadığı için liste şu an all-time puanla gösteriliyor.
                </p>
              ) : null}
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <MetricCard label="Toplam Üye" value={users.length} icon={<Users className="h-4 w-4" />} />
          <MetricCard label="En Yüksek Puan" value={topUser?.reputation_points ?? 0} icon={<Star className="h-4 w-4" />} />
          <MetricCard
            label="Sıralaman"
            value={myRank > 0 ? `#${myRank}` : "-"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
        </div>

        {myRank > 0 ? (
          <Surface variant="soft" border="default" className="border-primary/25 bg-primary/5 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Sıralaman: <span className="font-extrabold text-primary">#{myRank}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {users.find((item) => item.user_id === user?.id)?.reputation_points ?? 0} puan ile {users.length} kullanıcı arasındasın.
                </p>
              </div>
            </div>
          </Surface>
        ) : null}

        <ProductCard className="bg-gradient-to-b from-card to-secondary/20 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Kullanıcı veya bölüm ara..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>

            <Select value={uniFilter} onValueChange={setUniFilter}>
              <SelectTrigger className="h-9 w-full text-sm sm:w-[240px]">
                <SelectValue placeholder="Üniversite" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Üniversiteler</SelectItem>
                {universities.map((item) => (
                  <SelectItem key={item} value={item}>
                    {`${item} (${getUniversityMetaLabel(item)})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="h-9 shrink-0 self-center rounded-xl px-3 text-xs">
              {periodScoped.length} sonuç
            </Badge>
          </div>
        </ProductCard>

        {periodScoped.length >= 3 && !search.trim() && uniFilter === "all" ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-2"
          >
            {[1, 0, 2].map((index) => {
              const row = periodScoped[index];
              if (!row) return null;

              const heights = ["h-[7.5rem]", "h-40", "h-28"];
              const order = [1, 0, 2];
              const rank = index + 1;

              return (
                <Link to={`/user/${row.user_id}`} key={row.id} className="flex flex-col items-center">
                  <Surface
                    variant="soft"
                    border="subtle"
                    padding="sm"
                    radius="lg"
                    className={`w-full ${heights[order.indexOf(index)]} flex flex-col items-center justify-end ${index === 0 ? "border-amber-300/40 bg-amber-500/8 shadow-[var(--shadow-warm)]" : "bg-secondary/30"}`}
                  >
                    <Avatar className={`${index === 0 ? "h-12 w-12" : "h-10 w-10"} mb-1.5`}>
                      <AvatarFallback className={`${index === 0 ? "gradient-hero text-primary-foreground" : "bg-primary/10 text-primary"} text-sm font-bold`}>
                        {(row.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    {rank === 1 ? <Crown className="h-5 w-5 text-amber-500" /> : null}
                    {rank === 2 ? <Medal className="h-5 w-5 text-slate-400" /> : null}
                    {rank === 3 ? <Award className="h-5 w-5 text-orange-500" /> : null}

                    <p className="mt-1 max-w-full truncate font-heading text-xs font-bold">{row.username || "Anonim"}</p>
                    <p className="text-base font-extrabold text-primary">{row.reputation_points ?? 0}</p>
                  </Surface>
                </Link>
              );
            })}
          </motion.div>
        ) : null}

        <Surface className="overflow-hidden" variant="raised" padding="none" border="default" radius="lg">
          <div className="p-1.5">
            {loading ? (
              <StateBlock
                variant="loading"
                size="section"
                icon={<Flame className="h-5 w-5" />}
                title="Sıralama yükleniyor"
                description="Liderlik listesi hazırlanıyor."
              />
            ) : periodScoped.length > 0 ? (
              periodScoped.map((row, index) => {
                const rank = index + 1;

                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.35) }}
                  >
                    <Link
                      to={`/user/${row.user_id}`}
                      className={`mt-1.5 flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${index === 0 ? "mt-0" : ""} ${index < 3 ? "border-border/70 bg-secondary/45" : "border-transparent hover:border-border/70 hover:bg-secondary/30"} ${row.user_id === user?.id ? "ring-1 ring-primary/25" : ""}`}
                    >
                      <div className="flex h-6 w-6 items-center justify-center text-xs font-bold text-muted-foreground">
                        {rank === 1 ? <Crown className="h-4.5 w-4.5 text-amber-500" /> : null}
                        {rank === 2 ? <Medal className="h-4.5 w-4.5 text-slate-400" /> : null}
                        {rank === 3 ? <Award className="h-4.5 w-4.5 text-orange-500" /> : null}
                        {rank > 3 ? rank : null}
                      </div>

                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={`${index === 0 ? "gradient-hero text-primary-foreground" : "bg-primary/10 text-primary"} text-xs font-bold`}>
                          {(row.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-heading text-sm font-bold">{row.username || "Anonim"}</p>
                          {badgeMap.has(row.user_id) ? <BadgeDisplay badges={badgeMap.get(row.user_id)!} maxShow={3} size="xs" /> : null}
                        </div>

                        <AcademicMeta
                          size="sm"
                          tone="muted"
                          wrap={false}
                          items={[
                            ...(row.university
                              ? [
                                  {
                                    kind: "university" as const,
                                     label: "Üniversite",
                                    value: `${row.university} (${getUniversityMetaLabel(row.university)})`,
                                    emphasis: "subtle" as const,
                                  },
                                ]
                              : []),
                            ...(row.department
                              ? [{ kind: "department" as const, label: "Bölüm", value: row.department, emphasis: "subtle" as const }]
                              : []),
                            ...(!row.university && !row.department
                              ? [{ kind: "custom" as const, label: "Profil", value: "Akademik bilgi yok", emphasis: "subtle" as const }]
                              : []),
                          ]}
                          className="mt-0.5"
                        />
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-heading text-lg font-extrabold text-primary">{row.reputation_points ?? 0}</span>
                        <p className="text-xs text-muted-foreground">puan</p>
                      </div>
                    </Link>
                  </motion.div>
                );
              })
            ) : (
              <ProductEmptyState
                icon={<Search className="h-5 w-5" />}
                title="Sonuç bulunamadı"
                description="Filtreleri değiştirip yeniden deneyin."
              />
            )}
          </div>
        </Surface>
      </div>
    </Layout>
  );
}
