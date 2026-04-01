import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import CourseCard from "@/components/CourseCard";
import CreatePostDialog from "@/components/CreatePostDialog";
import SearchableSelect from "@/components/SearchableSelect";
import SuggestAcademicDialog from "@/components/SuggestAcademicDialog";
import AcademicProgramRequestDialog from "@/components/AcademicProgramRequestDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  type AcademicProgramRow,
  type UniversityCatalogRow,
} from "@/lib/academic-catalog";

type ContentType = Database["public"]["Enums"]["content_type"];
type PostWithProfile = Tables<"posts"> & { profiles: Tables<"profiles"> | null; course_name?: string };

const ALL_YEARS = ["TÃ¼mÃ¼", "HazÄ±rlÄ±k", "1. SÄ±nÄ±f", "2. SÄ±nÄ±f", "3. SÄ±nÄ±f", "4. SÄ±nÄ±f", "5. SÄ±nÄ±f", "6. SÄ±nÄ±f"];

const CONTENT_TYPES = [
  { value: "all", label: "TÃ¼mÃ¼" },
  { value: "notes", label: "Notlar" },
  { value: "past_exams", label: "Ã‡Ä±kmÄ±ÅŸ Sorular" },
  { value: "discussion", label: "TartÄ±ÅŸmalar" },
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
  past_exams: "SÄ±nav",
  discussion: "TartÄ±ÅŸma",
  kaynaklar: "Kaynak",
};

/* â”€â”€â”€ Stat Card (same style as admin panel) â”€â”€â”€ */
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

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
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
  const [selectedDept, setSelectedDept] = useState("TÃ¼mÃ¼");
  const [selectedYear, setSelectedYear] = useState("TÃ¼mÃ¼");
  const [selectedCourse, setSelectedCourse] = useState("TÃ¼mÃ¼");
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
    sublabel: u.city
      ? `${u.city} Â· ${u.type === "devlet" ? "Devlet" : u.type === "vakif" ? "VakÄ±f" : "Ãœniversite"}`
      : "TÃ¼rkiye",
    group: "",
  }));

  const browseDepartments = browseUniversity
    ? (() => {
        const courseDepts = [...new Set(courses.map((c: any) => c.department))];
        const canonicalDepts = browsePrograms.map((p) => p.program_name);
        const allDepts = [...new Set([...canonicalDepts, ...courseDepts])].sort((a, b) => a.localeCompare(b, "tr"));
        return ["TÃ¼mÃ¼", ...allDepts];
      })()
    : ["TÃ¼mÃ¼"];

  const filteredYears = (() => {
    if (selectedDept === "TÃ¼mÃ¼") return ALL_YEARS;
    const canonical = browsePrograms.find((p) => p.program_name === selectedDept);
    const maxYears = canonical?.program_years || 4;
    return ["TÃ¼mÃ¼", "HazÄ±rlÄ±k", ...Array.from({ length: maxYears }, (_, i) => `${i + 1}. SÄ±nÄ±f`)];
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

    setSelectedDept("TÃ¼mÃ¼");
    setSelectedCourse("TÃ¼mÃ¼");
    setSelectedYear("TÃ¼mÃ¼");
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
    if (selectedYear !== "TÃ¼mÃ¼" && !filteredYears.includes(selectedYear)) {
      setSelectedYear("TÃ¼mÃ¼");
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
        title: "SonuÃ§ bulunamadÄ±",
        description: `"${query}" iÃ§in eÅŸleÅŸen sonuÃ§ bulunamadÄ±.`,
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
    if (selectedDept !== "TÃ¼mÃ¼") {
      if (c.department !== selectedDept) return false;
    }
    if (selectedYear !== "TÃ¼mÃ¼") {
      if (selectedYear === "HazÄ±rlÄ±k") {
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

  const courseOptions = ["TÃ¼mÃ¼", ...filteredCourses.map((c: any) => c.name)];

  const canAddContent = user && userUniversity && browseUniversity === userUniversity;
  const isViewingOtherUniversity = browseUniversity && userUniversity && browseUniversity !== userUniversity;
  const currentUniversityId =
    catalogUniversities.find((u) => u.name === (browseUniversity || userUniversity || ""))?.id ||
    userUniversityId ||
    null;

  return (
    <>
      <Layout>
        {/* Hero */}
        <div className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="flex items-start justify-between gap-8">
              <div className="max-w-xl">
                {browseUniversity && (
                  <p className="text-xs font-medium text-primary mb-2 tracking-wide uppercase">
                    {browseUniversity}
                  </p>
                )}
                <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground leading-tight tracking-tight">
                  Akademik bilgiye ulaÅŸmanÄ±n en kolay yolu
                </h1>
                <p className="text-base text-muted-foreground mt-3 leading-relaxed">
                  Ders notlarÄ±, Ã§Ä±kmÄ±ÅŸ sorular ve tartÄ±ÅŸmalarla akademik baÅŸarÄ±nÄ± artÄ±r.
                </p>

                <form onSubmit={handleLocalSearch} className="mt-6 max-w-sm">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Ders, not veya kaynak ara..."
                      value={localSearch}
                      onChange={(e) => handleLocalSearchChange(e.target.value)}
                      className="pl-10 h-11 bg-muted border-transparent rounded-lg focus:border-border focus:bg-background"
                    />
                  </div>
                </form>
                {!canAddContent && user && !isViewingOtherUniversity && (
                  <p className="text-xs text-muted-foreground mt-4">Ä°Ã§erik eklemek iÃ§in Ã¼niversitenizi seÃ§in.</p>
                )}
              </div>

              {canAddContent && (
                <div className="hidden sm:flex flex-col items-center shrink-0 self-center">
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
                  <p className="text-[11px] text-muted-foreground mt-1.5 text-center leading-tight">
                    Not, sÄ±nav, kaynak veya<br />tartÄ±ÅŸma paylaÅŸ
                  </p>
                </div>
              )}
            </div>

            {/* Mobile floating create button */}
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

            {/* Stats Row - Admin Panel Style */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <StatCard icon={BookOpen} label="Toplam Ders" value={stats.courses} color="text-primary" />
              <StatCard icon={FileText} label="Toplam Ä°Ã§erik" value={stats.posts} color="text-emerald-500" />
              <StatCard icon={Users} label="Toplam Ãœye" value={stats.users} color="text-amber-500" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Main Content */}
            <div className="col-span-12 lg:col-span-8 space-y-6">
              {/* University Selector + Filters */}
              <Card className="p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Ãœniversite & Filtreler</span>
                  {isViewingOtherUniversity && (
                    <Badge variant="secondary" className="ml-auto text-[10px] gap-1">
                      <Building2 className="h-3 w-3" />
                      GÃ¶rÃ¼ntÃ¼leme
                    </Badge>
                  )}
                  {userUniversity && browseUniversity !== userUniversity && (
                    <button
                      onClick={() => {
                        setBrowseUniversity(userUniversity);
                        localStorage.setItem("browse-university", userUniversity);
                      }}
                      className="text-xs text-primary font-medium hover:underline ml-auto"
                    >
                      Kendi Ãœniversitem
                    </button>
                  )}
                </div>
                <SearchableSelect
                  value={browseUniversity || "TÃ¼m Ãœniversiteler"}
                  onValueChange={(val) => {
                    if (val === "TÃ¼m Ãœniversiteler") {
                      setBrowseUniversity("");
                      localStorage.removeItem("browse-university");
                    } else {
                      setBrowseUniversity(val);
                      localStorage.setItem("browse-university", val);
                    }
                  }}
                  placeholder="Ãœniversite seÃ§in..."
                  searchPlaceholder="Ãœniversite veya ÅŸehir ara..."
                  options={[
                    { label: "TÃ¼m Ãœniversiteler", sublabel: "TÃ¼m Ã¼niversitelerin derslerini gÃ¶rÃ¼ntÃ¼le" },
                    ...universityOptions,
                  ]}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                  <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedDept !== "TÃ¼mÃ¼" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="BÃ¶lÃ¼m" /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {browseDepartments.map((d) => <SelectItem key={d} value={d}>{d === "TÃ¼mÃ¼" ? "TÃ¼m BÃ¶lÃ¼mler" : d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedYear !== "TÃ¼mÃ¼" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="SÄ±nÄ±f" /></SelectTrigger>
                    <SelectContent>{filteredYears.map((y) => <SelectItem key={y} value={y}>{y === "TÃ¼mÃ¼" ? "TÃ¼m SÄ±nÄ±flar" : y}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedCourse !== "TÃ¼mÃ¼" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="Ders" /></SelectTrigger>
                    <SelectContent>{courseOptions.map((c) => <SelectItem key={c} value={c}>{c === "TÃ¼mÃ¼" ? "TÃ¼m Dersler" : c}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={selectedContentType} onValueChange={setSelectedContentType}>
                    <SelectTrigger className={`text-xs h-8 rounded-md ${selectedContentType !== "all" ? "border-primary/30 text-primary font-semibold" : "bg-muted border-transparent"}`}><SelectValue placeholder="TÃ¼r" /></SelectTrigger>
                    <SelectContent>{CONTENT_TYPES.map((ct) => <SelectItem key={ct.value} value={ct.value}>{ct.value === "all" ? "TÃ¼m TÃ¼rler" : ct.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {(selectedDept !== "TÃ¼mÃ¼" || selectedYear !== "TÃ¼mÃ¼" || selectedCourse !== "TÃ¼mÃ¼" || selectedContentType !== "all") && (
                  <button
                    onClick={() => { setSelectedDept("TÃ¼mÃ¼"); setSelectedYear("TÃ¼mÃ¼"); setSelectedCourse("TÃ¼mÃ¼"); setSelectedContentType("all"); }}
                    className="mt-2.5 text-xs text-primary font-medium hover:underline"
                  >
                    Filtreleri Temizle
                  </button>
                )}
              </Card>

              {/* Permission notice */}
              {isViewingOtherUniversity && (
                <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-accent/5 border border-accent/20">
                  <Lock className="h-3.5 w-3.5 text-accent shrink-0" />
                  <p className="text-xs text-accent">
                    <strong>{browseUniversity}</strong> iÃ§eriklerini gÃ¶rÃ¼ntÃ¼lÃ¼yorsunuz. Ä°Ã§erik eklemek iÃ§in kendi Ã¼niversitenizi seÃ§in.
                  </p>
                </div>
              )}

              {/* Search results */}
              {(searchQuery || searchResults.length > 0 || searchCourseResults.length > 0 || searchUserResults.length > 0) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Search className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h2 className="font-heading text-sm font-bold text-foreground">
                      {searching ? "AranÄ±yor..." : "Arama SonuÃ§larÄ±"}
                    </h2>
                  </div>

                  {searchCourseResults.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><BookOpen className="h-3 w-3" /> Dersler ({searchCourseResults.length})</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {searchCourseResults.map((c) => (
                          <Link key={c.id} to={`/course/${c.id}`}>
                            <Card className="p-3.5 rounded-lg hover:border-primary/20 hover-lift cursor-pointer">
                              <p className="text-sm font-semibold">{c.name}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {[normalizeCourseCode(c.code), c.department, c.university].filter(Boolean).join(" Â· ")}
                              </p>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchUserResults.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><Trophy className="h-3 w-3" /> KullanÄ±cÄ±lar ({searchUserResults.length})</h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {searchUserResults.map((u) => (
                          <Link key={u.id} to={`/user/${u.user_id}`}>
                            <Card className="p-3.5 rounded-lg hover:border-primary/20 hover-lift cursor-pointer flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{(u.username || "?")[0].toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-semibold">{u.username || "Anonim"}</p>
                                <p className="text-[11px] text-muted-foreground">{u.university || ""} Â· {u.reputation_points ?? 0} puan</p>
                              </div>
                            </Card>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Ä°Ã§erikler ({searchResults.length})</h3>
                      <div className="space-y-1">{searchResults.map((post) => <DiscoveryPostItem key={post.id} post={post} />)}</div>
                    </div>
                  )}

                  {!searching && searchResults.length === 0 && searchCourseResults.length === 0 && searchUserResults.length === 0 && (
                    <div className="text-center py-10 rounded-lg bg-muted/30">
                      <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-foreground mb-1">SonuÃ§ bulunamadÄ±</p>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        "{searchQuery || localSearch}" iÃ§in eÅŸleÅŸen sonuÃ§ bulunamadÄ±.
                      </p>
                    </div>
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
                    {filteredCourses.filter((c: any) => selectedCourse === "TÃ¼mÃ¼" || c.name === selectedCourse).length} ders
                  </Badge>
                </div>

                {!browseUniversity && filteredCourses.length === 0 && (
                  <div className="text-center py-10 rounded-lg bg-muted/30">
                    <GraduationCap className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-foreground mb-1">HenÃ¼z ders bulunamadÄ±</p>
                    <p className="text-xs text-muted-foreground">Filtreleri deÄŸiÅŸtirmeyi veya bir Ã¼niversite seÃ§meyi deneyin.</p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {filteredCourses
                    .filter((c: any) => selectedCourse === "TÃ¼mÃ¼" || c.name === selectedCourse)
                    .map((course: any) => (
                      <CourseCard key={course.id} course={course} postCounts={postCounts[course.id]} />
                    ))}
                </div>

                {filteredCourses.filter((c: any) => selectedCourse === "TÃ¼mÃ¼" || c.name === selectedCourse).length === 0 && courses.length > 0 && (
                  <div className="text-center py-10 rounded-lg bg-muted/30">
                    <p className="text-muted-foreground text-sm">Bu filtrelere uygun ders bulunamadÄ±.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-12 lg:col-span-4 space-y-5">
              {/* Top Contributors */}
              <Card className="overflow-hidden rounded-lg">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-amber-500/10 flex items-center justify-center">
                    <Trophy className="h-3 w-3 text-amber-500" />
                  </div>
                  <h3 className="font-heading text-sm font-bold flex-1">KatkÄ±da Bulunanlar</h3>
                  <Link to="/leaderboard" className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5">
                    TÃ¼mÃ¼ <ArrowRight className="h-3 w-3" />
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
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">{p.reputation_points ?? 0}</span>
                    </Link>
                  )) : (<p className="text-xs text-muted-foreground py-4 text-center">HenÃ¼z katkÄ± saÄŸlayan yok.</p>)}
                </div>
              </Card>

              {/* Discovery Sections */}
              {!searchQuery && (
                discoveryLoading ? (
                  <div className="text-center py-8">
                    <div className="inline-block h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    <DiscoverySection icon={MessageSquare} title="Aktif TartÄ±ÅŸmalar" posts={activeDiscussions} showComments emptyText="HenÃ¼z tartÄ±ÅŸma yok." color="text-discussion" />
                    <DiscoverySection icon={Clock} title="Son Eklenenler" posts={recentNotes} emptyText="HenÃ¼z not eklenmemiÅŸ." color="text-notes" />
                  </>
                )
              )}
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
    { value: "notes" as ContentType, label: "Not YÃ¼kle", icon: FileText, color: "text-blue-500", bg: "bg-blue-500/10" },
    { value: "past_exams" as ContentType, label: "Ã‡Ä±kmÄ±ÅŸ Soru", icon: Hash, color: "text-orange-500", bg: "bg-orange-500/10" },
    { value: "discussion" as ContentType, label: "TartÄ±ÅŸma AÃ§", icon: MessageSquare, color: "text-emerald-500", bg: "bg-emerald-500/10" },
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
          Ä°Ã§erik Ekle
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
              {selectedConfig?.label || "Ä°Ã§erik OluÅŸtur"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">1. BÃ¶lÃ¼m SeÃ§in</Label>
              <SearchableSelect
                value={department}
                onValueChange={(v) => { setDepartment(v); setCourseId(""); }}
                placeholder="BÃ¶lÃ¼m seÃ§in..."
                searchPlaceholder="BÃ¶lÃ¼m ara..."
                options={departments.map((d) => ({ label: d }))}
              />
              <button
                type="button"
                className="text-xs text-primary hover:underline cursor-pointer"
                disabled={!universityId}
                onClick={() => setMissingDeptOpen(true)}
              >
                BÃ¶lÃ¼mÃ¼mÃ¼ bulamadÄ±m
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
              <Label className={`text-xs font-semibold ${!department ? "text-muted-foreground" : ""}`}>2. Ders SeÃ§in</Label>
              <SearchableSelect
                value={selectedCourseLabel}
                onValueChange={(label) => {
                  const course = filteredCourses.find((c: any) => buildCourseSelectLabel(c) === label);
                  setCourseId(course?.id || "");
                }}
                placeholder={department ? "Ders seÃ§in..." : "Ã–nce bÃ¶lÃ¼m seÃ§in"}
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
                  Dersimi bulamadÄ±m
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
  return (
    <Card className="overflow-hidden rounded-lg">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <div className={`h-6 w-6 rounded-md bg-opacity-10 flex items-center justify-center ${color === "text-discussion" ? "bg-primary/10" : "bg-emerald-500/10"}`}>
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
        <p className="text-xs text-muted-foreground py-6 text-center">{emptyText}</p>
      )}
    </Card>
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

