import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronRight, Compass, Search, Users } from "lucide-react";

import Layout from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { StateBlock } from "@/components/ui/state-blocks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatUniversityMetaLabel, getUniversityTypeLabel } from "@/lib/academic-catalog";

type UniversityRow = Tables<"universities">;
type CourseRow = Pick<Tables<"courses">, "university_id">;

export default function UniversitiesPage() {
  const [universities, setUniversities] = useState<UniversityRow[]>([]);
  const [courseCounts, setCourseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "devlet" | "vakif">("all");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data: universitiesData, error: universitiesError }, { data: coursesData, error: coursesError }] =
        await Promise.all([
          supabase
            .from("universities")
            .select("id,name,city,type,country,created_at,created_by")
            .in("country", ["TR", "KKTC"])
            .order("name", { ascending: true }),
          supabase.from("courses").select("university_id").not("university_id", "is", null),
        ]);

      if (cancelled) return;

      if (universitiesError) {
        setUniversities([]);
        setCourseCounts({});
        setLoading(false);
        return;
      }

      const counts: Record<string, number> = {};
      if (!coursesError && coursesData) {
        for (const row of coursesData as CourseRow[]) {
          if (!row.university_id) continue;
          counts[row.university_id] = (counts[row.university_id] || 0) + 1;
        }
      }

      setUniversities((universitiesData || []) as UniversityRow[]);
      setCourseCounts(counts);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return universities.filter((item) => {
      const typeLabel = getUniversityTypeLabel(item.type).toLocaleLowerCase("tr-TR");
      const itemType = typeLabel.includes("vakıf") ? "vakif" : typeLabel.includes("devlet") ? "devlet" : "";
      if (typeFilter !== "all" && itemType !== typeFilter) return false;

      if (!q) return true;
      return [item.name, item.city || "", typeLabel].some((field) => field.toLocaleLowerCase("tr-TR").includes(q));
    });
  }, [search, typeFilter, universities]);

  const hasFilters = Boolean(search.trim() || typeFilter !== "all");

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <Surface variant="soft" border="subtle" padding="md" radius="xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Üniversiteler</p>
          <h1 className="mt-1 font-heading text-xl font-extrabold tracking-tight sm:text-[1.7rem]">
            Kurumsal bağlamdan bölüme ve derse ilerle
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Üniversiteyi seç, bölüm ve ders katmanına in, ardından Course Hub içinde devam et.
          </p>
        </Surface>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_190px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Üniversite veya şehir ara..."
                    className="h-9 pl-9"
                  />
                </div>

                <Select value={typeFilter} onValueChange={(value: "all" | "devlet" | "vakif") => setTypeFilter(value)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Türler</SelectItem>
                    <SelectItem value="devlet">Devlet</SelectItem>
                    <SelectItem value="vakif">Vakıf</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Badge variant="secondary" className="h-9 px-3 text-xs font-semibold">
                    {filtered.length} üniversite
                  </Badge>
                  {hasFilters ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        setSearch("");
                        setTypeFilter("all");
                      }}
                    >
                      Temizle
                    </Button>
                  ) : null}
                </div>
              </div>
            </Surface>

            {loading ? (
              <StateBlock
                variant="loading"
                size="section"
                title="Üniversiteler yükleniyor"
                description="Kurumsal bağlam listesi hazırlanıyor."
              />
            ) : filtered.length === 0 ? (
              <StateBlock
                variant="noResults"
                size="section"
                title="Üniversite bulunamadı"
                description="Arama veya filtreyi güncelleyip tekrar deneyin."
                primaryAction={
                  <Button
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setTypeFilter("all");
                    }}
                  >
                    Filtreleri Temizle
                  </Button>
                }
                secondaryAction={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/courses">Derslere Git</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {filtered.map((item) => (
                  <Link key={item.id} to={`/universities/${item.id}`}>
                    <Surface
                      variant="base"
                      border="subtle"
                      padding="md"
                      radius="xl"
                      className="h-full transition-colors hover:border-primary/30 hover:bg-secondary/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-1 font-heading text-sm font-bold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatUniversityMetaLabel({ city: item.city, type: item.type })}
                          </p>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {courseCounts[item.id] || 0} ders ile ilişkili
                          </p>
                          <p className="mt-2 text-xs font-semibold text-primary">Üniversite Detayına Git</p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <ChevronRight className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                    </Surface>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <aside className="hidden space-y-3 lg:block">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Compass className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-heading text-sm font-bold">Bu Ekranın Rolü</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Üniversiteler ekranı üst bağlamdır. Üniversiteyi seçer, ardından ders katmanına geçersin.
              </p>
              <div className="mt-2 rounded-lg bg-secondary/50 px-2.5 py-2 text-[11px] text-muted-foreground">
                Course Hub alternatifi değildir, giriş kapısıdır.
              </div>
            </Surface>

            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-heading text-sm font-bold">Geçiş Mantığı</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Üniversite → Bölüm → Ders → Course Hub</p>
              <Button asChild size="sm" className="mt-3 h-8 w-full">
                <Link to="/courses">Derslere Git</Link>
              </Button>
            </Surface>

            <Surface variant="soft" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Topluluk Sınırı</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Üniversite bağlamı topluluk görünürlüğü sağlar; tam topluluk deneyimi Topluluklar ekranında yaşanır.
              </p>
            </Surface>
          </aside>

          <div className="space-y-3 lg:hidden">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-sm font-bold">Bağlam Geçişi</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Üniversite seçtikten sonra bölüm ve ders katmanına inerek Course Hub'a geçebilirsin.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/courses">Dersler</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/">Ana Akış</Link>
                </Button>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </Layout>
  );
}
