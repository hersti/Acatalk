import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Building2, Compass, MessageCircle, Users } from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { StateBlock } from "@/components/ui/state-blocks";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatUniversityMetaLabel } from "@/lib/academic-catalog";
import { normalizeCourseCode } from "@/lib/course-code";

type UniversityRow = Tables<"universities">;
type ProgramRow = Pick<Tables<"academic_programs">, "id" | "program_name" | "unit_name">;
type CourseRow = Pick<Tables<"courses">, "id" | "name" | "code" | "department" | "year">;

export default function UniversityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [university, setUniversity] = useState<UniversityRow | null>(null);
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: universityData, error: universityError } = await supabase
        .from("universities")
        .select("id,name,city,type,country,created_at,created_by")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (universityError || !universityData) {
        setUniversity(null);
        setPrograms([]);
        setCourses([]);
        setLoading(false);
        return;
      }

      const [{ data: programData }, { data: courseData }] = await Promise.all([
        supabase
          .from("academic_programs")
          .select("id,program_name,unit_name")
          .eq("is_active", true)
          .eq("university_id", universityData.id)
          .order("program_name", { ascending: true })
          .limit(200),
        supabase
          .from("courses")
          .select("id,name,code,department,year")
          .eq("university_id", universityData.id)
          .order("name", { ascending: true })
          .limit(200),
      ]);

      if (cancelled) return;

      setUniversity(universityData as UniversityRow);
      setPrograms((programData || []) as ProgramRow[]);
      setCourses((courseData || []) as CourseRow[]);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const program of programs) {
      if (program.program_name) set.add(program.program_name);
    }
    for (const course of courses) {
      if (course.department) set.add(course.department);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [courses, programs]);

  if (loading) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <StateBlock
            variant="loading"
            size="section"
            title="Üniversite detayı yükleniyor"
            description="Bölüm ve ders bağlamı hazırlanıyor."
          />
        </div>
      </Layout>
    );
  }

  if (!university) {
    return (
      <Layout>
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
          <StateBlock
            variant="noResults"
            size="section"
            title="Üniversite bulunamadı"
            description="Bağlantı geçersiz olabilir veya üniversite kaydı taşınmış olabilir."
            primaryAction={
              <Button size="sm" variant="outline" onClick={() => navigate("/universities")}>
                Üniversitelere Dön
              </Button>
            }
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" className="mb-2 h-8 px-0 text-xs" onClick={() => navigate("/universities")}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Üniversitelere Dön
        </Button>

        <Surface variant="soft" border="subtle" padding="md" radius="xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Üniversite Detay</p>
          <h1 className="mt-1 font-heading text-xl font-extrabold tracking-tight">{university.name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatUniversityMetaLabel({ city: university.city, type: university.type })}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs">
              {departments.length} bölüm
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {programs.length} program
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {courses.length} ders
            </Badge>
          </div>
        </Surface>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-sm font-bold">Bölüm Görünümü</h2>
              </div>

              {departments.length === 0 ? (
                <StateBlock
                  variant="empty"
                  size="inline"
                  title="Henüz bölüm görünmüyor"
                  description="Bölüm verisi güncellendiğinde burada listelenecek."
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {departments.slice(0, 24).map((department) => (
                    <Badge key={department} variant="outline" className="text-xs">
                      {department}
                    </Badge>
                  ))}
                </div>
              )}
            </Surface>

            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-sm font-bold">Ders Geçişleri</h2>
              </div>

              {courses.length === 0 ? (
                <StateBlock
                  variant="empty"
                  size="inline"
                  title="Henüz ders bulunamadı"
                  description="Bu üniversite için ders listesi güncellendiğinde burada görünecek."
                />
              ) : (
                <div className="space-y-1.5">
                  {courses.slice(0, 12).map((course) => (
                    <Link key={course.id} to={`/course/${course.id}`}>
                      <Surface
                        variant="soft"
                        border="subtle"
                        padding="sm"
                        radius="lg"
                        className="transition-colors hover:border-primary/30 hover:bg-secondary/30"
                      >
                        <p className="text-sm font-semibold">{course.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[normalizeCourseCode(course.code || ""), course.department].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-primary">Course Hub’a Git</p>
                      </Surface>
                    </Link>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="h-8">
                  <Link to={`/courses?university=${encodeURIComponent(university.name)}`}>Tüm Dersleri Aç</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="h-8">
                  <Link to="/">Ana Akışa Dön</Link>
                </Button>
              </div>
            </Surface>
          </div>

          <aside className="hidden space-y-3 lg:block">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Compass className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-heading text-sm font-bold">Sonraki Adım</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Buradan ders listesine geçip Course Hub akışına in veya topluluk merkezine yönlen.
              </p>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to={`/courses?university=${encodeURIComponent(university.name)}`}>Derslere Git</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to={`/communities?university=${encodeURIComponent(university.name)}`}>Topluluk Merkezine Git</Link>
                </Button>
              </div>
            </Surface>

            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="font-heading text-sm font-bold">Topluluk Ön İzleme</h2>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Üniversiteye bağlı toplulukları bu ekranda bağlam olarak görürsün. Tam topluluk deneyimi ayrı merkezde
                yönetilir.
              </p>
            </Surface>

            <Surface variant="soft" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageCircle className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Ekran Sınırı</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Üniversite Detay ekranı course veya topluluk ana yüzeyi değildir. Karar noktasıdır, nihai çalışma ders
                katmanında sürer.
              </p>
            </Surface>
          </aside>

          <div className="space-y-3 lg:hidden">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-sm font-bold">Hızlı Geçiş</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Üniversite detayından sonra ders listesine geçip Course Hub içinde devam edebilirsin.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to={`/courses?university=${encodeURIComponent(university.name)}`}>Dersler</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/communities">Topluluklar</Link>
                </Button>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </Layout>
  );
}
