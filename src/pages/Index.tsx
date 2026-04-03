import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import CourseCard from "@/components/CourseCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import SearchableSelect from "@/components/SearchableSelect";
import SuggestAcademicDialog from "@/components/SuggestAcademicDialog";
import AcademicProgramRequestDialog from "@/components/AcademicProgramRequestDialog";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import {
  Search, GraduationCap, BookOpen, Clock, Trophy, FileText,
  MessageSquare, Filter, Download, ThumbsUp, TrendingUp, Plus, Building2, Globe, Lock, Users, ArrowRight, Layers, Hash
} from "lucide-react";
import type { Tables, Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { buildCourseSelectLabel, normalizeCourseCode } from "@/lib/course-code";
import {
  fetchAcademicProgramsForUniversity,
  fetchUniversitiesCatalog,
  formatUniversityMetaLabel,
  type AcademicProgramRow,
  type UniversityCatalogRow,
} from "@/lib/academic-catalog";

type ContentType = Database["public"]["Enums"]["content_type"];
type PostWithProfile = Tables<"posts"> & { profiles: Tables<"profiles"> | null; course_name?: string };

const ALL_YEARS = ["Tümü", "Hazırlık", "1. Sınıf", "2. Sınıf", "3. Sınıf", "4. Sınıf", "5. Sınıf", "6. Sınıf"];

const CONTENT_TYPES = [
  { value: "all", label: "Tümü" },
  { value: "notes", label: "Notlar" },
  { value: "past_exams", label: "Çıkmış Sorular" },
  { value: "discussion", label: "Tartışmalar" },
  { value: "kaynaklar", label: "Kaynaklar" },
];

const typeBadgeClass: Record<string, string> = {
  notes: "content-badge-notes",
  past_exams: "content-badge-exams",
  discussion: "content-badge-discussion",
  kaynaklar: "content-badge-kaynaklar",
};
const typeLabels: Record<string, string> = {
  notes: "Not",
  past_exams: "Sınav",
  discussion: "Tartışma",
  kaynaklar: "Kaynak",
};

/* ─── Stat Card (same style as admin panel) ─── */
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <Surface className="p-4" border="subtle">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-8 w-8 rounded-lg ${color} bg-opacity-10 flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
    </Surface>
  );
}

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const searchQuery = searchParams.get("search") || "";

  const [courses, setCourses] = useState<any[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, any>>({});
  const [stats, setStats] = useState({ courses: 0, posts: 0, users: 0 });

  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [recentNotes, setRecentNotes] = useState<PostWithProfile[]>([]);
  const [topDownloaded, setTopDownloaded] = useState<PostWithProfile[]>([]);
  const [topVoted, setTopVoted] = useState<PostWithProfile[]>([]);
  const [activeDiscussions, setActiveDiscussions] = useState<PostWithProfile[]>([]);
  const [topContributors, setTopContributors] = useState<Tables<"profiles">[]>([]);

  const [browseUniversity, setBrowseUniversity] = useState("");
  const [selectedDept, setSelectedDept] = useState("Tümü");
  const [selectedYear, setSelectedYear] = useState("Tümü");
  const [selectedCourse, setSelectedCourse] = useState("Tümü");
  const [selectedContentType, setSelectedContentType] = useState("all");
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [searchResults, setSearchResults] = useState<PostWithProfile[]>([]);
  const [searchCourseResults, setSearchCourseResults] = useState<any[]>([]);
  const [searchUserResults, setSearchUserResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const [userUniversity, setUserUniversity] = useState<string | null>(null);
  const [userUniversityId, setUserUniversityId] = useState<string | null>(null);
  const [catalogUniversities, setCatalogUniversities] = useState<UniversityCatalogRow[]>([]);
  const [browsePrograms, setBrowsePrograms] = useState<AcademicProgramRow[]>([]);

  const [homeCreateOpen, setHomeCreateOpen] = useState(false);
  const [homeCreateCourseId, setHomeCreateCourseId] = useState("");
  const [homeCreateType, setHomeCreateType] = useState<ContentType>("notes");

  const universityOptions = catalogUniversities.map((u) => ({
    label: u.name,
    sublabel: formatUniversityMetaLabel({ city: u.city, type: u.type }),
    group: "",
  }));

  const browseDepartments = browseUniversity
    ? (() => {
        const courseDepts = [...new Set(courses.map((c: any) => c.department))];
        const canonicalDepts = browsePrograms.map((p) => p.program_name);
        const allDepts = [...new Set([...canonicalDepts, ...courseDepts])].sort((a, b) => a.localeCompare(b, "tr"));
        return ["Tümü", ...allDepts];
      })()
    : ["Tümü"];

  const filteredYears = (() => {
    if (selectedDept === "Tümü") return ALL_YEARS;
    const canonical = browsePrograms.find((p) => p.program_name === selectedDept);
    const maxYears = canonical?.program_years || 4;
    return ["Tümü", "Hazırlık", ...Array.from({ length: maxYears }, (_, i) => `${i + 1}. Sınıf`)];
  })();

  const loadCatalogUniversities = async () => {
    try {
      const rows = await fetchUniversitiesCatalog();
      setCatalogUniversities(rows);
    } catch {
      setCatalogUniversities([]);
    }
  };

  useEffect(() => {
    const savedUni = localStorage.getItem("browse-university");
    if (savedUni) setBrowseUniversity(savedUni);
    fetchStats();
    fetchDiscoverySections();
    fetchTopContributors();
    void loadCatalogUniversities();
  }, []);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("university, university_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.university) {
          setUserUniversity(data.university);
          setUserUniversityId((data as any)?.university_id || null);

          if (!browseUniversity && !localStorage.getItem("browse-university")) {
            setBrowseUniversity(data.university);
            localStorage.setItem("browse-university", data.university);
          }
        }
      });
  }, [user]);

  useEffect(() => {
    setLocalSearch(searchQuery);
    if (searchQuery) {
      performSearch(searchQuery);
    } else {
      setSearchResults([]);
      setSearchCourseResults([]);
      setSearchUserResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;

    if (browseUniversity) {
      localStorage.setItem("browse-university", browseUniversity);
    }

    setSelectedDept("Tümü");
    setSelectedCourse("Tümü");
    setSelectedYear("Tümü");
    fetchCourses();

    const loadPrograms = async () => {
      if (!browseUniversity) {
        setBrowsePrograms([]);
        return;
      }
      try {
        const rows = await fetchAcademicProgramsForUniversity(browseUniversity);
        if (!cancelled) setBrowsePrograms(rows);
      } catch {
        if (!cancelled) setBrowsePrograms([]);
      }
    };

    void loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [browseUniversity]);

  useEffect(() => {
    if (selectedYear !== "Tümü" && !filteredYears.includes(selectedYear)) {
      setSelectedYear("Tümü");
    }
  }, [selectedDept, filteredYears]);
  const fetchStats = async () => {
    const [c, p, u] = await Promise.all([
      supabase.from("courses").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setStats({ courses: c.count ?? 0, posts: p.count ?? 0, users: u.count ?? 0 });
  };

  const fetchCourses = async () => {
    const requestId = ++coursesFetchRequestRef.current;

    let query = supabase.from("courses").select("*").order("name");
    if (browseUniversity) {
      query = query.eq("university", browseUniversity);
    }

    const { data: coursesData } = await query;

    // Prevent stale responses from overwriting the latest university filter state
    if (requestId !== coursesFetchRequestRef.current) return;

    if (!coursesData) {
      setCourses([]);
      setPostCounts({});
      return;
    }

    setCourses(coursesData);
    const courseIds = coursesData.map((c) => c.id);

    if (courseIds.length === 0) {
      setPostCounts({});
      return;
    }

    const { data: posts } = await supabase
      .from("posts")
      .select("course_id, content_type")
      .in("course_id", courseIds);

    if (requestId !== coursesFetchRequestRef.current) return;

    if (!posts) {
      setPostCounts({});
      return;
    }

    const counts: Record<string, any> = {};
    posts.forEach((p) => {
      if (!counts[p.course_id]) counts[p.course_id] = { notes: 0, past_exams: 0, discussion: 0, kaynaklar: 0 };
      if (counts[p.course_id][p.content_type] !== undefined) counts[p.course_id][p.content_type]++;
    });
    setPostCounts(counts);
  };

  const enrichPosts = async (posts: any[]): Promise<PostWithProfile[]> => {
    if (!posts.length) return [];
    const userIds = [...new Set(posts.map((p) => p.user_id))];
    const courseIds = [...new Set(posts.map((p) => p.course_id))];
    const [profilesRes, coursesRes] = await Promise.all([
      supabase.from("profiles").select("*").in("user_id", userIds),
      supabase.from("courses").select("id, name").in("id", courseIds),
    ]);
    const profileMap = new Map(profilesRes.data?.map((p) => [p.user_id, p]) || []);
    const courseMap = new Map(coursesRes.data?.map((c) => [c.id, c.name]) || []);
    return posts.map((p) => ({ ...p, profiles: profileMap.get(p.user_id) || null, course_name: courseMap.get(p.course_id) || "" }));
  };

  const fetchDiscoverySections = async () => {
    setDiscoveryLoading(true);
    try {
      const [recentRes, downloadedRes, votedRes, discussionRes] = await Promise.all([
        supabase.from("posts").select("*").in("content_type", ["notes", "past_exams", "kaynaklar"]).order("created_at", { ascending: false }).limit(5),
        supabase.from("posts").select("*").in("content_type", ["notes", "past_exams", "kaynaklar"]).order("download_count", { ascending: false }).limit(5),
        supabase.from("posts").select("*").order("helpful_count", { ascending: false }).limit(5),
        supabase.from("posts").select("*").eq("content_type", "discussion").order("comment_count", { ascending: false }).limit(5),
      ]);
      const [r1, r2, r3, r4] = await Promise.all([
        enrichPosts(recentRes.data || []),
        enrichPosts(downloadedRes.data || []),
        enrichPosts(votedRes.data || []),
        enrichPosts(discussionRes.data || []),
      ]);
      setRecentNotes(r1);
      setTopDownloaded(r2);
      setTopVoted(r3);
      setActiveDiscussions(r4);
    } catch (err) {
      console.error("Discovery fetch error:", err);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const fetchTopContributors = async () => {
    const { data } = await supabase.from("profiles").select("*").order("reputation_points", { ascending: false }).limit(5);
    if (data) setTopContributors(data as any);
  };

  const performSearch = async (query: string) => {
    setSearching(true);
    const [postsRes, coursesRes, usersRes] = await Promise.all([
      supabase.from("posts").select("*").or(`title.ilike.%${query}%,content.ilike.%${query}%`).order("created_at", { ascending: false }).limit(20),
      supabase.from("courses").select("*").or(`name.ilike.%${query}%,code.ilike.%${query}%`).limit(10),
      supabase.from("profiles").select("*").ilike("username", `%${query}%`).limit(10),
    ]);
    const posts = await enrichPosts(postsRes.data || []);
    const courses = coursesRes.data || [];
    const users = usersRes.data || [];
    setSearchResults(posts);
    setSearchCourseResults(courses);
    setSearchUserResults(users);
    setSearching(false);

    if (posts.length === 0 && courses.length === 0 && users.length === 0) {
      toast({
        title: "Sonuç bulunamadı",
        description: `"${query}" için eşleşen sonuç bulunamadı.`,
      });
    }
  };

  const localSearchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const coursesFetchRequestRef = useRef(0);

  const handleLocalSearchChange = (value: string) => {
    setLocalSearch(value);
    if (localSearchDebounceRef.current) clearTimeout(localSearchDebounceRef.current);
    localSearchDebounceRef.current = setTimeout(() => {
      if (value.trim()) {
        setSearchParams({ search: value.trim() }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 300);
  };

  const handleLocalSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const filteredCourses = courses.filter((c) => {
    if (selectedDept !== "Tümü") {
      if (c.department !== selectedDept) return false;
    }
    if (selectedYear !== "Tümü") {
      if (selectedYear === "Hazırlık") {
        if (c.year !== 0) return false;
      } else {
        const yearNum = parseInt(selectedYear);
        if (c.year !== yearNum) return false;
      }
    }
    if (selectedContentType !== "all") {
      const counts = postCounts[c.id];
      if (!counts || (counts[selectedContentType] || 0) === 0) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const normalizedQueryCode = normalizeCourseCode(searchQuery);
      const normalizedCourseCode = normalizeCourseCode(c.code);
      if (
        !c.name.toLowerCase().includes(q) &&
        !(normalizedQueryCode && normalizedCourseCode.includes(normalizedQueryCode))
      ) {
        return false;
      }
    }
    return true;
  });

  const courseOptions = ["Tümü", ...filteredCourses.map((c: any) => c.name)];

  const canAddContent = user && userUniversity && browseUniversity === userUniversity;
  const isViewingOtherUniversity = browseUniversity && userUniversity && browseUniversity !== userUniversity;
  const currentUniversityId =
    catalogUniversities.find((u) => u.name === (browseUniversity || userUniversity || ""))?.id ||
    userUniversityId ||
    null;

  return (
    <>
      <Layout>
        <div className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Surface variant="soft" border="subtle" padding="lg" radius="xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Home Feed
                  </p>
                  <h1 className="mt-1 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
                    Akademik içerikleri tek akışta takip et
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                    Ders notları, çıkmış sorular ve tartışmaları üniversite ve bölüm bağlamıyla keşfet.
                  </p>
                  <form onSubmit={handleLocalSearch} className="mt-4 max-w-md">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Ders, not veya kaynak ara..."
                        value={localSearch}
                        onChange={(e) => handleLocalSearchChange(e.target.value)}
                        className="h-10 rounded-lg border-border/70 bg-background pl-9"
                      />
                    </div>
                  </form>
                  {!canAddContent && user && !isViewingOtherUniversity && (
                    <p className="mt-3 text-xs text-muted-foreground">İçerik eklemek için üniversitenizi seçin.</p>
                  )}
                </div>

                {canAddContent && (
                  <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
                    <HomepageCreateButton
                      courses={courses}
                      university={browseUniversity || userUniversity || ""}
                      universityId={currentUniversityId}
                      onSelectCourse={(courseId, type) => {
                        setHomeCreateCourseId(courseId);
                        setHomeCreateType(type);
                        setHomeCreateOpen(true);
                      }}
                    />
                    <p className="text-[11px] text-muted-foreground text-center leading-tight">
                      Not, sınav, kaynak veya tartışma paylaş
                    </p>
                  </div>
                )}
              </div>
            </Surface>

            {canAddContent && (
              <div className="sm:hidden fixed bottom-20 right-4 z-40">
                <HomepageCreateButton
                  courses={courses}
                  university={browseUniversity || userUniversity || ""}
                  universityId={currentUniversityId}
                  onSelectCourse={(courseId, type) => {
                    setHomeCreateCourseId(courseId);
                    setHomeCreateType(type);
                    setHomeCreateOpen(true);
                  }}
                />
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard icon={BookOpen} label="Toplam Ders" value={stats.courses} color="text-primary" />
              <StatCard icon={FileText} label="Toplam İçerik" value={stats.posts} color="text-emerald-500" />
              <StatCard icon={Users} label="Toplam Üye" value={stats.users} color="text-amber-500" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Main Content */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* University Selector + Filters */}
              <Surface variant="base" border="subtle" padding="md" radius="xl">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Üniversite & Filtreler</span>
                  {isViewingOtherUniversity && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Building2 className="h-3 w-3" />
                      Görüntüleme
                    </Badge>
                  )}
                  {userUniversity && browseUniversity !== userUniversity && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBrowseUniversity(userUniversity);
                        localStorage.setItem("browse-university", userUniversity);
                      }}
                      className="ml-auto h-7 px-2 text-xs font-medium text-primary hover:bg-primary/5 hover:text-primary"
                    >
                      Kendi Üniversitem
                    </Button>
                  )}
                </div>
                <SearchableSelect
                  value={browseUniversity || "Tüm Üniversiteler"}
                  onValueChange={(val) => {
                    if (val === "Tüm Üniversiteler") {
                      setBrowseUniversity("");
                      localStorage.removeItem("browse-university");
                    } else {
                      setBrowseUniversity(val);
                      localStorage.setItem("browse-university", val);
                    }
                  }}
                  placeholder="Üniversite seçin..."
                  searchPlaceholder="Üniversite veya şehir ara..."
                  options={[
                    { label: "Tüm Üniversiteler", sublabel: "Tüm üniversitelerin derslerini görüntüle" },
                    ...universityOptions,
                  ]}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedDept !== "Tümü" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="Bölüm" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {browseDepartments.map((d) => <SelectItem key={d} value={d}>{d === "Tümü" ? "Tüm Bölümler" : d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedYear !== "Tümü" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="Sınıf" /></SelectTrigger>
                    <SelectContent>{filteredYears.map((y) => <SelectItem key={y} value={y}>{y === "Tümü" ? "Tüm Sınıflar" : y}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedCourse !== "Tümü" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="Ders" /></SelectTrigger>
                    <SelectContent>{courseOptions.map((c) => <SelectItem key={c} value={c}>{c === "Tümü" ? "Tüm Dersler" : c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedContentType} onValueChange={setSelectedContentType}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedContentType !== "all" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="Tür" /></SelectTrigger>
                    <SelectContent>{CONTENT_TYPES.map((ct) => <SelectItem key={ct.value} value={ct.value}>{ct.value === "all" ? "Tüm Türler" : ct.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {(selectedDept !== "Tümü" || selectedYear !== "Tümü" || selectedCourse !== "Tümü" || selectedContentType !== "all") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setSelectedDept("Tümü"); setSelectedYear("Tümü"); setSelectedCourse("Tümü"); setSelectedContentType("all"); }}
                    className="mt-2.5 h-7 px-2 text-xs font-medium text-primary hover:bg-primary/5 hover:text-primary"
                  >
                    Filtreleri Temizle
                  </Button>
                )}
              </Surface>

              {/* Permission notice */}
              {isViewingOtherUniversity && (
                <Surface variant="soft" border="subtle" padding="sm" radius="lg" className="flex items-center gap-2.5 border-accent/20 bg-accent/5">
                  <Lock className="h-3.5 w-3.5 text-accent shrink-0" />
                  <p className="text-xs text-accent">
                    <strong>{browseUniversity}</strong> içeriklerini görüntülüyorsunuz. İçerik eklemek için kendi üniversitenizi seçin.
                  </p>
                </Surface>
              )}

              {/* Search results */}
              {(searchQuery || searchResults.length > 0 || searchCourseResults.length > 0 || searchUserResults.length > 0) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Search className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h2 className="font-heading text-sm font-bold text-foreground">
                      {searching ? "Aranıyor..." : "Arama Sonuçları"}
                    </h2>
                  </div>

                  {searchCourseResults.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> Dersler ({searchCourseResults.length})</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {searchCourseResults.map((c) => (
                          <Link key={c.id} to={`/course/${c.id}`}>
                            <Surface variant="base" border="subtle" padding="md" radius="lg" className="hover:border-primary/20 hover-lift cursor-pointer">
                              <p className="text-sm font-semibold">{c.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {[normalizeCourseCode(c.code), c.department, c.university].filter(Boolean).join(" · ")}
                              </p>
                            </Surface>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchUserResults.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Trophy className="h-3 w-3" /> Kullanıcılar ({searchUserResults.length})</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {searchUserResults.map((u) => (
                          <Link key={u.id} to={`/user/${u.user_id}`}>
                            <Surface variant="base" border="subtle" padding="md" radius="lg" className="hover:border-primary/20 hover-lift cursor-pointer flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{(u.username || "?")[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-semibold">{u.username || "Anonim"}</p>
                                <p className="text-[11px] text-muted-foreground">{u.university || ""} · {u.reputation_points ?? 0} puan</p>
                              </div>
                            </Surface>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><FileText className="h-3 w-3" /> İçerikler ({searchResults.length})</h3>
                      <div className="space-y-1">{searchResults.map((post) => <DiscoveryPostItem key={post.id} post={post} />)}</div>
                    </div>
                  )}

                  {!searching && searchResults.length === 0 && searchCourseResults.length === 0 && searchUserResults.length === 0 && (
                    <StateBlock
                      variant="noResults"
                      size="section"
                      icon={<Search className="h-5 w-5" />}
                      title="Sonuç bulunamadı"
                      description={`"${searchQuery || localSearch}" için eşleşen sonuç bulunamadı.`}
                    />
                  )}
                </div>
              )}

              {/* Courses */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h2 className="font-heading text-base font-bold">Dersler</h2>
                  </div>
                  <Badge variant="secondary" className="text-[10px] font-semibold">
                    {filteredCourses.filter((c: any) => selectedCourse === "Tümü" || c.name === selectedCourse).length} ders
                  </Badge>
                </div>

                {!browseUniversity && filteredCourses.length === 0 && (
                  <StateBlock
                    variant="empty"
                    size="section"
                    icon={<GraduationCap className="h-5 w-5" />}
                    title="Henüz ders bulunamadı"
                    description="Filtreleri değiştirmeyi veya bir üniversite seçmeyi deneyin."
                  />
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredCourses
                    .filter((c: any) => selectedCourse === "Tümü" || c.name === selectedCourse)
                    .map((course: any) => (
                      <CourseCard key={course.id} course={course} postCounts={postCounts[course.id]} />
                    ))}
                </div>

                {filteredCourses.filter((c: any) => selectedCourse === "Tümü" || c.name === selectedCourse).length === 0 && courses.length > 0 && (
                  <StateBlock
                    variant="noResults"
                    size="section"
                    title="Bu filtrelere uygun ders bulunamadı"
                    description="Filtre kombinasyonunu değiştirip tekrar deneyin."
                  />
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-12 lg:col-span-4">
              <div className="space-y-5 lg:sticky lg:top-20">
              <Surface variant="soft" border="subtle" padding="md" radius="xl">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <h3 className="font-heading text-sm font-bold">Hızlı Görünüm</h3>
                </div>
                <AcademicMeta
                  size="sm"
                  tone="muted"
                  items={[
                    { kind: "custom", label: "Ders", value: String(stats.courses), emphasis: "subtle" },
                    { kind: "custom", label: "İçerik", value: String(stats.posts), emphasis: "subtle" },
                    { kind: "custom", label: "Üye", value: String(stats.users), emphasis: "subtle" },
                  ]}
                />
              </Surface>

              {/* Top Contributors */}
              <Surface variant="base" border="subtle" padding="none" radius="xl" className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <Trophy className="h-3 w-3 text-amber-500" />
                  </div>
                  <h3 className="font-heading text-sm font-bold flex-1">Katkıda Bulunanlar</h3>
                  <Link to="/leaderboard" className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5">
                    Tümü <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="p-4 space-y-3">
                  {topContributors.length > 0 ? topContributors.map((p: any, i) => (
                    <Link key={p.id} to={`/user/${p.user_id}`} className="flex items-center gap-3 group">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        i === 0 ? "bg-primary text-primary-foreground" : i < 3 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>{i + 1}</span>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">{(p.username || "?")[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.username || "Anonim"}</p>
                        <AcademicMeta
                          size="sm"
                          tone="muted"
                          wrap={false}
                          className="mt-0.5"
                          items={[
                            ...(p.university ? [{ kind: "university" as const, label: "Üniversite", value: p.university, emphasis: "subtle" as const }] : []),
                            ...(p.department ? [{ kind: "department" as const, label: "Bölüm", value: p.department, emphasis: "subtle" as const }] : []),
                          ]}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">{p.reputation_points ?? 0}</span>
                    </Link>
                  )) : (<p className="text-xs text-muted-foreground py-4 text-center">Henüz katkı sağlayan yok.</p>)}
                </div>
              </Surface>

              {/* Discovery Sections */}
              {!searchQuery && (
                discoveryLoading ? (
                  <StateBlock variant="loading" size="inline" title="Keşif yükleniyor" description="İkincil içerikler hazırlanıyor." />
                ) : (
                  <>
                    <DiscoverySection icon={Download} title="En Çok İndirilenler" posts={topDownloaded} showDownloads emptyText="Henüz indirilen içerik yok." color="text-notes" />
                    <DiscoverySection icon={ThumbsUp} title="En Faydalı İçerikler" posts={topVoted} showVotes emptyText="Henüz oylanan içerik yok." color="text-primary" />
                    <DiscoverySection icon={MessageSquare} title="Aktif Tartışmalar" posts={activeDiscussions} showComments emptyText="Henüz tartışma yok." color="text-discussion" />
                    <DiscoverySection icon={Clock} title="Son Eklenenler" posts={recentNotes} emptyText="Henüz not eklenmemiş." color="text-notes" />
                  </>
                )
              )}
              </div>
            </div>
          </div>
        </div>
      </Layout>

      {user && homeCreateCourseId && (
        <CreatePostDialog
          courseId={homeCreateCourseId}
          defaultType={homeCreateType}
          onCreated={() => { setHomeCreateOpen(false); setHomeCreateCourseId(""); fetchDiscoverySections(); fetchCourses(); }}
          externalOpen={homeCreateOpen}
          onOpenChange={(open) => { if (!open) { setHomeCreateOpen(false); setHomeCreateCourseId(""); } }}
        />
      )}
    </>
  );
}

/* Homepage Create Content Button - Dropup Style */
function HomepageCreateButton({
  courses,
  university,
  universityId,
  onSelectCourse,
}: {
  courses: any[];
  university: string;
  universityId: string | null;
  onSelectCourse: (courseId: string, type: ContentType) => void;
}) {
  const [dropupOpen, setDropupOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ContentType>("notes");
  const [department, setDepartment] = useState("");
  const [courseId, setCourseId] = useState("");

  const [localCourses, setLocalCourses] = useState<any[]>(courses);
  const [programRows, setProgramRows] = useState<AcademicProgramRow[]>([]);

  const [missingDeptOpen, setMissingDeptOpen] = useState(false);
  const [missingCourseOpen, setMissingCourseOpen] = useState(false);

  useEffect(() => { setLocalCourses(courses); }, [courses]);

  useEffect(() => {
    let cancelled = false;

    const loadPrograms = async () => {
      if (!dialogOpen || !university) {
        setProgramRows([]);
        return;
      }
      try {
        const rows = await fetchAcademicProgramsForUniversity(university);
        if (!cancelled) setProgramRows(rows);
      } catch {
        if (!cancelled) setProgramRows([]);
      }
    };

    void loadPrograms();

    return () => {
      cancelled = true;
    };
  }, [dialogOpen, university]);

  const departmentsFromCourses = [...new Set(localCourses.map((c: any) => c.department))].filter(Boolean);
  const canonicalDepartments = programRows.map((p) => p.program_name);
  const departments = [...new Set([...canonicalDepartments, ...departmentsFromCourses])].sort((a, b) => a.localeCompare(b, "tr"));

  const filteredCourses = department ? localCourses.filter((c: any) => c.department === department) : [];
  const selectedCourse = courseId ? filteredCourses.find((c: any) => c.id === courseId) : null;
  const selectedCourseLabel = selectedCourse ? buildCourseSelectLabel(selectedCourse) : "";
  const courseSelectOptions = filteredCourses.map((c: any) => ({
    label: buildCourseSelectLabel(c),
  }));

  const CONTENT_TYPE_OPTIONS = [
    { value: "notes" as ContentType, label: "Not Yükle", icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
    { value: "past_exams" as ContentType, label: "Çıkmış Soru", icon: Hash, color: "text-orange-500", bg: "bg-orange-500/10" },
    { value: "discussion" as ContentType, label: "Tartışma Aç", icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { value: "kaynaklar" as ContentType, label: "Kaynak Ekle", icon: Layers, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  const handleTypeSelect = (type: ContentType) => {
    setSelectedType(type);
    setDropupOpen(false);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    if (!courseId) return;
    onSelectCourse(courseId, selectedType);
    setDialogOpen(false);
    setDepartment("");
    setCourseId("");
  };

  const handleDialogClose = (v: boolean) => {
    if (!v) {
      setDialogOpen(false);
      setDepartment("");
      setCourseId("");
      setMissingDeptOpen(false);
      setMissingCourseOpen(false);
    }
  };

  const dropupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropupRef.current && !dropupRef.current.contains(e.target as Node)) {
        setDropupOpen(false);
      }
    };
    if (dropupOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropupOpen]);

  const selectedConfig = CONTENT_TYPE_OPTIONS.find(o => o.value === selectedType);

  return (
    <>
      {/* Dropup Button */}
      <div className="relative" ref={dropupRef}>
        <Button
          onClick={() => setDropupOpen(!dropupOpen)}
          className="h-12 gap-2 shrink-0 rounded-xl px-6 text-sm font-bold"
          style={{ boxShadow: 'var(--shadow-warm)' }}
        >
          <Plus className={`h-5 w-5 transition-transform ${dropupOpen ? "rotate-45" : ""}`} />
          İçerik Ekle
        </Button>

        {dropupOpen && (
          <div className="absolute top-full mt-2 right-0 w-48 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            {CONTENT_TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleTypeSelect(opt.value)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`h-8 w-8 rounded-lg ${opt.bg} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${opt.color}`} />
                  </div>
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Department/Course Selection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {selectedConfig && (
                <div className={`h-7 w-7 rounded-lg ${selectedConfig.bg} flex items-center justify-center`}>
                  <selectedConfig.icon className={`h-3.5 w-3.5 ${selectedConfig.color}`} />
                </div>
              )}
              {selectedConfig?.label || "İçerik Oluştur"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">1. Bölüm Seçin</Label>
              <SearchableSelect
                value={department}
                onValueChange={(v) => { setDepartment(v); setCourseId(""); }}
                placeholder="Bölüm seçin..."
                searchPlaceholder="Bölüm ara..."
                options={departments.map((d) => ({ label: d }))}
              />
              <button
                type="button"
                className="text-xs text-primary hover:underline cursor-pointer"
                disabled={!universityId}
                onClick={() => setMissingDeptOpen(true)}
              >
                Bölümümü bulamadım
              </button>

              <AcademicProgramRequestDialog
                open={missingDeptOpen}
                onOpenChange={setMissingDeptOpen}
                context="content_add"
                defaultUniversityId={universityId}
                defaultUniversityName={university}
                onSubmitted={async () => {
                  const rows = await fetchAcademicProgramsForUniversity(university);
                  setProgramRows(rows);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className={`text-xs font-semibold ${!department ? "text-muted-foreground" : ""}`}>2. Ders Seçin</Label>
              <SearchableSelect
                value={selectedCourseLabel}
                onValueChange={(label) => {
                  const course = filteredCourses.find((c: any) => buildCourseSelectLabel(c) === label);
                  setCourseId(course?.id || "");
                }}
                placeholder={department ? "Ders seçin..." : "Önce bölüm seçin"}
                searchPlaceholder="Ders ara..."
                options={courseSelectOptions}
                disabled={!department}
              />
              {department && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline cursor-pointer"
                  onClick={() => setMissingCourseOpen(true)}
                >
                  Dersimi bulamadım
                </button>
              )}

              <SuggestAcademicDialog
                type="course"
                university={university}
                department={department}
                open={missingCourseOpen}
                onOpenChange={setMissingCourseOpen}
                onApproved={async ({ course_id, normalized_name }) => {
                  if (!course_id) return;
                  const { data } = await supabase.from("courses").select("*").eq("id", course_id).maybeSingle();
                  if (data) {
                    setLocalCourses((prev) => {
                      if (prev.some((c: any) => c.id === course_id)) return prev;
                      return [...prev, data];
                    });
                  }
                  setCourseId(course_id);
                  void normalized_name;
                }}
              />
            </div>

            <Button onClick={handleCreate} disabled={!courseId} className="w-full h-10 rounded-lg">
              Devam Et
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* Discovery Section Component */
function DiscoverySection({ icon: Icon, title, posts, showDownloads, showVotes, showComments, emptyText, color = "text-primary" }: {
  icon: any; title: string; posts: PostWithProfile[]; emptyText: string;
  showDownloads?: boolean; showVotes?: boolean; showComments?: boolean; color?: string;
}) {
  const iconBgClass = color === "text-discussion" || color === "text-primary" ? "bg-primary/10" : "bg-emerald-500/10";

  return (
    <Surface variant="base" border="subtle" padding="none" radius="xl" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className={`h-6 w-6 rounded-md bg-opacity-10 flex items-center justify-center ${iconBgClass}`}>
          <Icon className={`h-3 w-3 ${color}`} />
        </div>
        <h3 className="font-heading text-sm font-bold">{title}</h3>
      </div>
      {posts.length > 0 ? (
        <div className="divide-y divide-border/30">
          {posts.slice(0, 4).map((post) => (
            <DiscoveryPostItem key={post.id} post={post} showDownloads={showDownloads} showVotes={showVotes} showComments={showComments} />
          ))}
        </div>
      ) : (
        <StateBlock variant="empty" size="inline" title={emptyText} description="Yeni içerikler geldikçe burada listelenecek." className="rounded-none border-0" />
      )}
    </Surface>
  );
}

/* Post Item for discovery sections */
function DiscoveryPostItem({ post, showDownloads, showVotes, showComments }: {
  post: PostWithProfile; showDownloads?: boolean; showVotes?: boolean; showComments?: boolean;
}) {
  const voteCount = post.helpful_count ?? 0;
  const downloadCount = (post as any).download_count ?? 0;
  const commentCount = (post as any).comment_count ?? 0;

  return (
    <Link to={`/post/${post.id}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/30 transition-colors">
      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold shrink-0 ${typeBadgeClass[post.content_type]}`}>
        {typeLabels[post.content_type]}
      </span>
      <p className="text-sm font-medium truncate flex-1">{post.title}</p>
      <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
        {(showVotes || (!showDownloads && !showComments)) && voteCount > 0 && (
          <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" /> {voteCount}</span>
        )}
        {showDownloads && downloadCount > 0 && (
          <span className="flex items-center gap-0.5"><Download className="h-2.5 w-2.5" /> {downloadCount}</span>
        )}
        {showComments && commentCount > 0 && (
          <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" /> {commentCount}</span>
        )}
      </div>
    </Link>
  );
}

