import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Compass, Filter, GraduationCap, Search } from "lucide-react";

import Layout from "@/components/Layout";
import CourseCard from "@/components/CourseCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { StateBlock } from "@/components/ui/state-blocks";
import SearchableSelect from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  fetchUniversitiesCatalog,
  formatUniversityMetaLabel,
  type UniversityCatalogRow,
} from "@/lib/academic-catalog";

type CourseRow = Tables<"courses">;
type PostCountMap = Record<string, { notes: number; past_exams: number; discussion: number; kaynaklar: number }>;

const ALL_UNIVERSITIES = "__all_universities__";

export default function CoursesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [universities, setUniversities] = useState<UniversityCatalogRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [postCounts, setPostCounts] = useState<PostCountMap>({});
  const [loading, setLoading] = useState(true);

  const searchQuery = searchParams.get("search") || "";
  const universityQuery = searchParams.get("university") || "";
  const hasFilters = Boolean(searchQuery.trim() || universityQuery.trim());

  const [searchDraft, setSearchDraft] = useState(searchQuery);

  useEffect(() => {
    setSearchDraft(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;

    const loadUniversities = async () => {
      try {
        const rows = await fetchUniversitiesCatalog();
        if (!cancelled) setUniversities(rows);
      } catch {
        if (!cancelled) setUniversities([]);
      }
    };

    void loadUniversities();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      setLoading(true);
      let query = supabase
        .from("courses")
        .select(
          "id,name,code,department,description,university,university_id,year,academic_program_id,is_common,program_level,created_at",
        )
        .order("name", { ascending: true })
        .limit(400);

      if (universityQuery) {
        query = query.eq("university", universityQuery);
      }

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery.trim()}%,code.ilike.%${searchQuery.trim()}%`);
      }

      const { data: coursesData } = await query;
      if (cancelled) return;

      const rows = (coursesData || []) as CourseRow[];
      setCourses(rows);

      if (rows.length === 0) {
        setPostCounts({});
        setLoading(false);
        return;
      }

      const courseIds = rows.map((course) => course.id);
      const { data: posts } = await supabase
        .from("posts")
        .select("course_id,content_type")
        .eq("status", "published")
        .in("course_id", courseIds);

      if (cancelled) return;

      const nextCounts: PostCountMap = {};
      for (const post of posts || []) {
        const current = nextCounts[post.course_id] || { notes: 0, past_exams: 0, discussion: 0, kaynaklar: 0 };
        if (post.content_type in current) {
          current[post.content_type as keyof typeof current] += 1;
        }
        nextCounts[post.course_id] = current;
      }

      setPostCounts(nextCounts);
      setLoading(false);
    };

    void loadCourses();

    return () => {
      cancelled = true;
    };
  }, [searchQuery, universityQuery]);

  const universityOptions = useMemo(
    () => [
      {
        label: "Tüm Üniversiteler",
        value: ALL_UNIVERSITIES,
        itemDescription: "Üniversite filtresi uygulanmaz",
      },
      ...universities.map((item) => ({
        label: item.name,
        value: item.name,
        itemDescription: formatUniversityMetaLabel({ city: item.city, type: item.type }),
      })),
    ],
    [universities],
  );

  const applyFilters = (event?: FormEvent) => {
    event?.preventDefault();
    const params = new URLSearchParams(searchParams);

    if (searchDraft.trim()) params.set("search", searchDraft.trim());
    else params.delete("search");

    setSearchParams(params);
  };

  const updateUniversityFilter = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === ALL_UNIVERSITIES) params.delete("university");
    else params.set("university", value);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearchParams(new URLSearchParams());
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <Surface variant="soft" border="subtle" padding="md" radius="xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dersler</p>
          <h1 className="mt-1 font-heading text-xl font-extrabold tracking-tight sm:text-[1.7rem]">
            Dersleri filtrele ve doğrudan Course Hub’a geç
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Bu ekran doğrudan akademik erişim alanıdır. Sosyal keşif için Ana Akış ekranını kullan.
          </p>
        </Surface>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <form className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_280px_auto]" onSubmit={applyFilters}>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Ders adı veya ders kodu ara..."
                    className="h-9 pl-9"
                  />
                </div>

                <SearchableSelect
                  value={universityQuery || ALL_UNIVERSITIES}
                  onValueChange={updateUniversityFilter}
                  placeholder="Üniversite seçin"
                  searchPlaceholder="Üniversite ara..."
                  options={universityOptions}
                  variant="filter"
                  panelSize="wide"
                  className="h-9"
                />

                <div className="flex gap-2">
                  <Button type="submit" size="sm" className="h-9 gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    Filtreyi Uygula
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-9" onClick={clearFilters}>
                    Temizle
                  </Button>
                </div>
              </form>

              {hasFilters ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {searchQuery ? (
                    <Badge variant="outline" className="text-[11px]">
                      Arama: {searchQuery}
                    </Badge>
                  ) : null}
                  {universityQuery ? (
                    <Badge variant="outline" className="text-[11px]">
                      Üniversite: {universityQuery}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </Surface>

            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs font-semibold">
                {courses.length} ders
              </Badge>
              <Button asChild variant="link" size="sm" className="h-auto px-0 text-xs">
                <Link to="/">Ana Akış'a Dön</Link>
              </Button>
            </div>

            {loading ? (
              <StateBlock
                variant="loading"
                size="section"
                title="Dersler yükleniyor"
                description="Course Hub listesi hazırlanıyor."
              />
            ) : courses.length === 0 ? (
              <StateBlock
                variant="noResults"
                size="section"
                title="Ders bulunamadı"
                description="Arama veya üniversite filtresiyle eşleşen ders yok."
                primaryAction={
                  <Button size="sm" onClick={clearFilters}>
                    Filtreleri Temizle
                  </Button>
                }
                secondaryAction={
                  <Button asChild size="sm" variant="outline">
                    <Link to="/universities">Üniversitelere Git</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {courses.map((course) => (
                  <CourseCard key={course.id} course={course} postCounts={postCounts[course.id]} />
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
                Dersler ekranı katalog ve hızlı erişim yüzeyidir. Buradan doğrudan Course Hub’a geçersin.
              </p>
              <div className="mt-2 rounded-lg bg-secondary/50 px-2.5 py-2 text-[11px] text-muted-foreground">
                Ana Akış’ın yerine geçmez, keşfi tamamlar.
              </div>
            </Surface>

            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <GraduationCap className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-heading text-sm font-bold">Hızlı Geçiş</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Üst bağlamı görmek için Üniversiteler ekranına, keşif için Ana Akış’a geçebilirsin.
              </p>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/universities">Üniversitelere Git</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/">Ana Akışa Dön</Link>
                </Button>
              </div>
            </Surface>

            <Surface variant="soft" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Bağlam Notu</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Nihai akademik çalışma course içinde devam eder. Bu ekran giriş ve yönlendirme katmanıdır.
              </p>
            </Surface>
          </aside>

          <div className="space-y-3 lg:hidden">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-sm font-bold">Hızlı Geçiş</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Ders katalogundan sonra keşif veya üst bağlam ekranına geçebilirsin.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/universities">Üniversiteler</Link>
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
