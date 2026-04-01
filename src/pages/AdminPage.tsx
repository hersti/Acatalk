import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { tr } from "date-fns/locale";
import Layout from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatUniversityMetaLabel, type UniversityCatalogRow } from "@/lib/academic-catalog";
import {
  Shield, Users, FileText, MessageSquare, Flag, BarChart3,
  Trash2, CheckCircle, XCircle, AlertTriangle, Plus, Pencil, BookOpen,
  Search, Eye, ChevronLeft, ChevronRight, GraduationCap,
  Building2, Layers, Star, ThumbsUp, ShieldAlert, ShieldCheck, Ban,
  VolumeX, UserX, CircleAlert, RefreshCw, Download, Clock,
  Mail, Activity, TrendingUp, Hash, Filter, MoreHorizontal,
} from "lucide-react";
const PAGE_SIZE = 25;

// ─── Helper Components ───
function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 h-9 text-sm" />
    </div>
  );
}

function PaginationControls({ page, setPage, total }: { page: number; setPage: (p: number) => void; total: number }) {
  const tp = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (tp <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 px-4 pb-3">
      <span className="text-xs text-muted-foreground">{total} sonuç · Sayfa {page + 1}/{tp}</span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= tp - 1} onClick={() => setPage(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: number | string; color: string; onClick?: () => void }) {
  return (
    <Card className={`p-4 ${onClick ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`} onClick={onClick}>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Bekliyor", variant: "destructive" },
    reviewed: { label: "İncelendi", variant: "secondary" },
    resolved: { label: "Çözüldü", variant: "default" },
    dismissed: { label: "Reddedildi", variant: "outline" },
    open: { label: "Açık", variant: "destructive" },
    replied: { label: "Yanıtlandı", variant: "default" },
    closed: { label: "Kapatıldı", variant: "secondary" },
    approved: { label: "Onaylandı", variant: "default" },
    rejected: { label: "Reddedildi", variant: "destructive" },
    flagged: { label: "İşaretli", variant: "destructive" },
    blocked: { label: "Engellendi", variant: "destructive" },
    false_positive: { label: "Yanlış Alarm", variant: "secondary" },
    under_review: { label: "İnceleniyor", variant: "outline" },
  };
  const s = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
}

function UserStatusBadges({ user: u }: { user: any }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {u.is_suspended && <Badge variant="destructive" className="text-[9px]">Askıda</Badge>}
      {u.is_muted && <Badge className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-300">Susturulmuş</Badge>}
      {(u.moderation_score || 0) > 0 && !u.is_muted && !u.is_suspended && (
        <Badge variant="outline" className="text-[9px] text-amber-600">{u.moderation_score} puan</Badge>
      )}
      {!u.is_suspended && !u.is_muted && (u.moderation_score || 0) === 0 && (
        <Badge variant="outline" className="text-[9px] text-green-600">Aktif</Badge>
      )}
    </div>
  );
}

// ─── NAV ───
const NAV_ITEMS = [
  { key: "stats", label: "Genel Bakış", icon: BarChart3 },
  { key: "users", label: "Kullanıcılar", icon: Users },
  { key: "moderation", label: "Moderasyon", icon: ShieldCheck },
  { key: "suggestions", label: "Öneriler", icon: GraduationCap },
  { key: "support", label: "Destek", icon: CircleAlert },
  { key: "courses", label: "Dersler", icon: BookOpen },
  { key: "posts", label: "Gönderiler", icon: FileText },
  { key: "comments", label: "Yorumlar", icon: MessageSquare },
  { key: "reports", label: "Raporlar", icon: Flag },
  { key: "security", label: "Güvenlik", icon: ShieldAlert },
];

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Data
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [moderationQueue, setModerationQueue] = useState<any[]>([]);
  const [moderationLogs, setModerationLogs] = useState<any[]>([]);
  const [academicSuggestions, setAcademicSuggestions] = useState<any[]>([]);
  const [academicProgramRequests, setAcademicProgramRequests] = useState<any[]>([]);
  const [domainRequests, setDomainRequests] = useState<any[]>([]);
  const [universitiesCatalog, setUniversitiesCatalog] = useState<UniversityCatalogRow[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState("stats");
  const [dataLoading, setDataLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [userSearch, setUserSearch] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [postSearch, setPostSearch] = useState("");
  const [postTypeFilter, setPostTypeFilter] = useState("all");
  const [commentSearch, setCommentSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseUniFilter, setCourseUniFilter] = useState("all");
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportSearch, setReportSearch] = useState("");
  const [securityLogFilter, setSecurityLogFilter] = useState("all");
  const [securitySearch, setSecuritySearch] = useState("");
  const [modQueueFilter, setModQueueFilter] = useState("all");
  const [modSearch, setModSearch] = useState("");
  const [suggestionFilter, setSuggestionFilter] = useState("pending");
  const [domainRequestFilter, setDomainRequestFilter] = useState("pending");
  const [domainRequestDrafts, setDomainRequestDrafts] = useState<Record<string, {
    university_name: string;
    domain: string;
    country: "TR" | "KKTC";
    city: string;
    type: string;
    admin_note: string;
    seed_general_department: boolean;
  }>>({});

  // Pages
  const [userPage, setUserPage] = useState(0);
  const [postPage, setPostPage] = useState(0);
  const [commentPage, setCommentPage] = useState(0);
  const [coursePage, setCoursePage] = useState(0);
  const [reportPage, setReportPage] = useState(0);
  const [securityPage, setSecurityPage] = useState(0);
  const [modQueuePage, setModQueuePage] = useState(0);
  const [modLogPage, setModLogPage] = useState(0);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, authLoading]);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setDataLoading(true);
    else setRefreshing(true);
    try {
      const [
        usersRes,
        postsRes,
        commentsRes,
        reportsRes,
        coursesRes,
        rolesRes,
        secLogsRes,
        modQueueRes,
        modLogsRes,
        suggestionsRes,
        programRequestsRes,
        deptsRes,
        ticketsRes,
        domainRequestsRes,
        universitiesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("posts").select("*").order("created_at", { ascending: false }),
        supabase.from("comments").select("*").order("created_at", { ascending: false }),
        supabase.from("reports").select("*").order("created_at", { ascending: false }),
        supabase.from("courses").select("*").order("name"),
        supabase.from("user_roles").select("*"),
        supabase.from("security_logs").select("*").order("created_at", { ascending: false }).limit(500) as any,
        supabase.from("moderation_queue").select("*").order("created_at", { ascending: false }).limit(500) as any,
        supabase.from("moderation_logs").select("*").order("created_at", { ascending: false }).limit(500) as any,
        supabase.from("academic_suggestions").select("*").order("created_at", { ascending: false }).limit(500) as any,
        supabase.from("academic_program_requests" as any).select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("departments").select("*") as any,
        supabase.from("support_tickets").select("*").order("created_at", { ascending: false }).limit(500) as any,
        supabase.from("university_domain_requests" as any).select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("universities" as any).select("*").in("country", ["TR", "KKTC"]).order("name", { ascending: true }),
      ]);
      setUsers(usersRes.data || []);
      setPosts(postsRes.data || []);
      setComments(commentsRes.data || []);
      setReports(reportsRes.data || []);
      setCourses(coursesRes.data || []);
      setRoles(rolesRes.data || []);
      setSecurityLogs(secLogsRes.data || []);
      setModerationQueue(modQueueRes.data || []);
      setModerationLogs(modLogsRes.data || []);
      setAcademicSuggestions(((suggestionsRes.data || []) as any[]).filter((s) => s.type !== "department"));
      setAcademicProgramRequests((programRequestsRes.data || []) as any[]);
      setDepartments(deptsRes.data || []);
      setSupportTickets(ticketsRes.data || []);
      setDomainRequests((domainRequestsRes.data || []) as any[]);
      setUniversitiesCatalog((universitiesRes.data || []) as any[]);
    } finally {
      setDataLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin, fetchAll]);

  // ─── Helpers ───
  const getUserRole = useCallback((userId: string) => {
    const r = roles.find((r: any) => r.user_id === userId);
    return r?.role || "user";
  }, [roles]);

  const getUsername = useCallback((userId: string) => {
    const u = users.find((u: any) => u.user_id === userId);
    return u?.username || "Anonim";
  }, [users]);

  const universityCatalogByName = useMemo(() => {
    const map = new Map<string, UniversityCatalogRow>();
    for (const row of universitiesCatalog) {
      if (row?.name) map.set(row.name, row);
    }
    return map;
  }, [universitiesCatalog]);

  const getUniversityMetaLabel = useCallback((universityName: string | null | undefined) => {
    const name = String(universityName || "").trim();
    if (!name) return "Tür bilgisi yok";
    const row = universityCatalogByName.get(name);
    return formatUniversityMetaLabel({
      city: row?.city || null,
      type: row?.type || null,
    });
  }, [universityCatalogByName]);

  const getCourseName = useCallback((courseId: string) => {
    const c = courses.find((c: any) => c.id === courseId);
    return c ? `${c.code || ""} ${c.name}`.trim() : "—";
  }, [courses]);

  const paginate = <T,>(items: T[], page: number): T[] => items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ─── Stats ───
  const stats = useMemo(() => {
    const universities = new Set([
      ...universitiesCatalog.map((u: any) => u.name).filter(Boolean),
      ...courses.map((c: any) => c.university).filter(Boolean),
      ...departments.map((d: any) => d.university).filter(Boolean),
      ...users.map((u: any) => u.university).filter(Boolean),
    ]);
    const deptSet = new Set([
      ...departments.map((d: any) => `${d.university}::${d.name}`),
      ...courses.map((c: any) => `${c.university}::${c.department}`),
    ].filter(Boolean));

    const mutedUsers = users.filter((u: any) => u.is_muted).length;
    const suspendedUsers = users.filter((u: any) => u.is_suspended).length;
    const flaggedUsers = users.filter((u: any) => (u.moderation_score || 0) > 0).length;
    const pendingReports = reports.filter((r: any) => r.status === "pending").length;
    const pendingMod = moderationQueue.filter((m: any) => m.status === "flagged").length;
    const pendingSuggestions =
      academicSuggestions.filter((s: any) => s.status === "pending").length +
      academicProgramRequests.filter((r: any) => r.status === "pending").length +
      domainRequests.filter((r: any) => r.status === "pending").length;
    const openTickets = supportTickets.filter((t: any) => t.status === "open").length;

    const contentCounts = {
      notes: posts.filter((p: any) => p.content_type === "notes").length,
      past_exams: posts.filter((p: any) => p.content_type === "past_exams").length,
      discussion: posts.filter((p: any) => p.content_type === "discussion").length,
      kaynaklar: posts.filter((p: any) => p.content_type === "kaynaklar").length,
    };

    const courseCounts: Record<string, number> = {};
    posts.forEach((p: any) => { courseCounts[p.course_id] = (courseCounts[p.course_id] || 0) + 1; });
    const topCourses = Object.entries(courseCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => {
        const c = courses.find((c: any) => c.id === id);
        return { name: c?.name || "—", code: c?.code || "", count };
      });

    const userPostCounts: Record<string, number> = {};
    posts.forEach((p: any) => { userPostCounts[p.user_id] = (userPostCounts[p.user_id] || 0) + 1; });
    const topUsers = Object.entries(userPostCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => {
        const u = users.find((u: any) => u.user_id === id);
        return { name: u?.username || "Anonim", count, rep: u?.reputation_points || 0 };
      });

    return {
      totalUsers: users.length, totalUniversities: universities.size, totalDepartments: deptSet.size,
      totalCourses: courses.length, totalPosts: posts.length, totalComments: comments.length,
      mutedUsers, suspendedUsers, flaggedUsers, pendingReports, pendingMod, pendingSuggestions,
      openTickets, totalReports: reports.length, contentCounts, topCourses, topUsers,
    };
  }, [users, posts, comments, reports, courses, departments, moderationQueue, academicSuggestions, academicProgramRequests, domainRequests, supportTickets, universitiesCatalog]);

  // ─── Filtered data ───
  const filteredUsers = useMemo(() => {
    let result = users;
    if (userStatusFilter === "muted") result = result.filter((u: any) => u.is_muted);
    else if (userStatusFilter === "suspended") result = result.filter((u: any) => u.is_suspended);
    else if (userStatusFilter === "flagged") result = result.filter((u: any) => (u.moderation_score || 0) > 0);
    else if (userStatusFilter === "active") result = result.filter((u: any) => !u.is_muted && !u.is_suspended);

    if (userRoleFilter !== "all") {
      result = result.filter((u: any) => getUserRole(u.user_id) === userRoleFilter);
    }

    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      result = result.filter((u: any) =>
        (u.username || "").toLowerCase().includes(q) ||
        (u.display_name || "").toLowerCase().includes(q) ||
        (u.university || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q) ||
        (u.user_id || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [users, userSearch, userStatusFilter, userRoleFilter, getUserRole]);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (postTypeFilter !== "all") result = result.filter((p: any) => p.content_type === postTypeFilter);
    if (postSearch.trim()) {
      const q = postSearch.toLowerCase();
      result = result.filter((p: any) =>
        p.title.toLowerCase().includes(q) ||
        (p.content || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [posts, postSearch, postTypeFilter]);

  const filteredComments = useMemo(() => {
    if (!commentSearch.trim()) return comments;
    const q = commentSearch.toLowerCase();
    return comments.filter((c: any) => c.content.toLowerCase().includes(q));
  }, [comments, commentSearch]);

  const filteredCourses = useMemo(() => {
    let result = courses;
    if (courseUniFilter !== "all") result = result.filter((c: any) => c.university === courseUniFilter);
    if (courseSearch.trim()) {
      const q = courseSearch.toLowerCase();
      result = result.filter((c: any) =>
        c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q) || c.department.toLowerCase().includes(q)
      );
    }
    return result;
  }, [courses, courseSearch, courseUniFilter]);

  const filteredReports = useMemo(() => {
    let result = reports;
    if (reportStatusFilter !== "all") result = result.filter((r: any) => r.status === reportStatusFilter);
    if (reportSearch.trim()) {
      const q = reportSearch.toLowerCase();
      result = result.filter((r: any) =>
        (r.reason || "").toLowerCase().includes(q) ||
        getUsername(r.reporter_id).toLowerCase().includes(q)
      );
    }
    return result;
  }, [reports, reportStatusFilter, reportSearch, getUsername]);

  const filteredModQueue = useMemo(() => {
    let result = moderationQueue;
    if (modQueueFilter !== "all") result = result.filter((m: any) => m.status === modQueueFilter);
    if (modSearch.trim()) {
      const q = modSearch.toLowerCase();
      result = result.filter((m: any) =>
        (m.content_text || "").toLowerCase().includes(q) ||
        (m.violation_type || "").toLowerCase().includes(q) ||
        getUsername(m.user_id).toLowerCase().includes(q)
      );
    }
    return result;
  }, [moderationQueue, modQueueFilter, modSearch, getUsername]);

  const filteredSuggestions = useMemo(() => {
    if (suggestionFilter === "all") return academicSuggestions;
    return academicSuggestions.filter((s: any) => s.status === suggestionFilter);
  }, [academicSuggestions, suggestionFilter]);

  const filteredAcademicProgramRequests = useMemo(() => {
    if (suggestionFilter === "all") return academicProgramRequests;
    return academicProgramRequests.filter((r: any) => r.status === suggestionFilter);
  }, [academicProgramRequests, suggestionFilter]);

  const filteredDomainRequests = useMemo(() => {
    if (domainRequestFilter === "all") return domainRequests;
    return domainRequests.filter((r: any) => r.status === domainRequestFilter);
  }, [domainRequests, domainRequestFilter]);

  const getDomainDraft = useCallback((request: any) => {
    const existing = domainRequestDrafts[request.id];
    if (existing) return existing;
    const inferredCountry: "TR" | "KKTC" =
      /kktc|kibris|lefkosa|girne|gazimagusa|magusa|iskele/i.test(request.claimed_university_name || "")
        ? "KKTC"
        : "TR";
    return {
      university_name: request.claimed_university_name || "",
      domain: request.request_email_domain || "",
      country: inferredCountry,
      city: "",
      type: "",
      admin_note: "",
      seed_general_department: true,
    };
  }, [domainRequestDrafts]);

  const updateDomainDraft = useCallback((request: any, patch: Partial<{
    university_name: string;
    domain: string;
    country: "TR" | "KKTC";
    city: string;
    type: string;
    admin_note: string;
    seed_general_department: boolean;
  }>) => {
    setDomainRequestDrafts((prev) => ({
      ...prev,
      [request.id]: {
        ...getDomainDraft(request),
        ...prev[request.id],
        ...patch,
      },
    }));
  }, [getDomainDraft]);

  const filteredSecurityLogs = useMemo(() => {
    let result = securityLogs;
    if (securityLogFilter !== "all") result = result.filter((l: any) => l.event_type === securityLogFilter);
    if (securitySearch.trim()) {
      const q = securitySearch.toLowerCase();
      result = result.filter((l: any) =>
        (l.event_type || "").toLowerCase().includes(q) ||
        getUsername(l.user_id).toLowerCase().includes(q)
      );
    }
    return result;
  }, [securityLogs, securityLogFilter, securitySearch, getUsername]);

  // ─── Badge counts ───
  const pendingReportsCount = reports.filter((r: any) => r.status === "pending").length;
  const pendingModCount = moderationQueue.filter((m: any) => m.status === "flagged").length;
  const pendingSuggestionsCount =
    academicSuggestions.filter((s: any) => s.status === "pending").length +
    academicProgramRequests.filter((r: any) => r.status === "pending").length +
    domainRequests.filter((r: any) => r.status === "pending").length;
  const openTicketsCount = supportTickets.filter((t: any) => t.status === "open").length;
  const isMissingFunctionError = (error: any) =>
    !!error &&
    ((error.code === "PGRST202" || error.code === "42883") ||
      String(error.message || "").includes("Could not find the function"));

  // ─── Action Handlers ───
  const handleDeletePost = async (postId: string) => {
    if (!confirm("Bu gönderiyi silmek istediğinizden emin misiniz?")) return;
    const { data: postComments } = await supabase.from("comments").select("id").eq("post_id", postId);
    if (postComments && postComments.length > 0) {
      await supabase.from("comment_likes").delete().in("comment_id", postComments.map((c: any) => c.id));
    }
    await supabase.from("comments").delete().eq("post_id", postId);
    await supabase.from("votes").delete().eq("post_id", postId);
    await supabase.from("bookmarks").delete().eq("post_id", postId);
    await supabase.from("post_downloads").delete().eq("post_id", postId);
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) toast.error("Silinemedi: " + error.message);
    else { toast.success("Gönderi silindi"); fetchAll(true); }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Bu yorumu silmek istediğinizden emin misiniz?")) return;
    const { data: childComments } = await supabase.from("comments").select("id").eq("parent_id", commentId);
    const allIds = [commentId, ...(childComments?.map((c: any) => c.id) || [])];
    await supabase.from("comment_likes").delete().in("comment_id", allIds);
    await supabase.from("comments").delete().eq("parent_id", commentId);
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) toast.error("Silinemedi: " + error.message);
    else { toast.success("Yorum silindi"); fetchAll(true); }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm("Bu dersi silmek istediğinizden emin misiniz? İlişkili tüm gönderiler de silinir.")) return;
    const relatedPosts = posts.filter((p: any) => p.course_id === courseId);
    if (relatedPosts.length > 0) {
      const postIds = relatedPosts.map((p: any) => p.id);
      const { data: relatedComments } = await supabase.from("comments").select("id").in("post_id", postIds);
      if (relatedComments && relatedComments.length > 0) {
        await supabase.from("comment_likes").delete().in("comment_id", relatedComments.map((c: any) => c.id));
      }
      await supabase.from("comments").delete().in("post_id", postIds);
      await supabase.from("votes").delete().in("post_id", postIds);
      await supabase.from("bookmarks").delete().in("post_id", postIds);
      await supabase.from("post_downloads").delete().in("post_id", postIds);
      await supabase.from("posts").delete().in("id", postIds);
    }
    await supabase.from("course_resources").delete().eq("course_id", courseId);
    await supabase.from("course_wikis").delete().eq("course_id", courseId);
    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    if (error) toast.error("Silinemedi: " + error.message);
    else { toast.success("Ders silindi"); fetchAll(true); }
  };

  const handleUpdateReport = async (reportId: string, status: string, adminNote?: string) => {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (adminNote !== undefined) updateData.admin_note = adminNote;
    const { error } = await supabase.from("reports").update(updateData).eq("id", reportId);
    if (error) toast.error("Güncellenemedi");
    else { toast.success("Rapor güncellendi"); fetchAll(true); }
  };

  const handleDeleteReportedContent = async (report: any, note: string) => {
    if (report.target_type === "post") {
      const { data: postComments } = await supabase.from("comments").select("id").eq("post_id", report.target_id);
      if (postComments && postComments.length > 0) {
        await supabase.from("comment_likes").delete().in("comment_id", postComments.map((c: any) => c.id));
      }
      await supabase.from("comments").delete().eq("post_id", report.target_id);
      await supabase.from("votes").delete().eq("post_id", report.target_id);
      await supabase.from("bookmarks").delete().eq("post_id", report.target_id);
      await supabase.from("post_downloads").delete().eq("post_id", report.target_id);
      await supabase.from("posts").delete().eq("id", report.target_id);
    } else if (report.target_type === "comment") {
      const { data: childComments } = await supabase.from("comments").select("id").eq("parent_id", report.target_id);
      const allIds = [report.target_id, ...(childComments?.map((c: any) => c.id) || [])];
      await supabase.from("comment_likes").delete().in("comment_id", allIds);
      await supabase.from("comments").delete().eq("parent_id", report.target_id);
      await supabase.from("comments").delete().eq("id", report.target_id);
    }
    await handleUpdateReport(report.id, "resolved", note || "İçerik silindi.");
    toast.success("İçerik silindi ve rapor çözüldü");
  };

  const handleMarkReportAbuse = async (report: any, note: string) => {
    await handleUpdateReport(report.id, "dismissed", note || "Asılsız rapor.");
    await supabase.rpc("increment_moderation_score", { p_user_id: report.reporter_id, p_points: 3, p_reason: "Asılsız rapor bildirimi" });
    await supabase.from("moderation_logs").insert({ user_id: report.reporter_id, action: "false_report_warning", admin_id: user?.id, reason: note || "Asılsız rapor" } as any);
    toast.success("Rapor asılsız olarak işaretlendi");
  };

  const getReportTargetUserId = (report: any) => {
    let targetUserId = report.target_id;
    if (report.target_type === "post") {
      const post = posts.find((p: any) => p.id === report.target_id);
      if (post) targetUserId = post.user_id;
    } else if (report.target_type === "comment") {
      const comment = comments.find((c: any) => c.id === report.target_id);
      if (comment) targetUserId = comment.user_id;
    }
    return targetUserId;
  };

  const handleWarnReportedUser = async (report: any, note: string) => {
    const targetUserId = getReportTargetUserId(report);
    await supabase.rpc("increment_moderation_score", { p_user_id: targetUserId, p_points: 2, p_reason: note || "Rapor sonucu uyarı" });
    await handleUpdateReport(report.id, "resolved", note || "Kullanıcı uyarıldı.");
    toast.success("Kullanıcı uyarıldı");
  };

  const handleMuteUser = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({
      is_muted: true, muted_until: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    } as any).eq("user_id", userId);
    if (error) { toast.error("Susturma başarısız"); return; }
    await supabase.from("moderation_logs").insert({ user_id: userId, action: "mute", admin_id: user?.id, reason: "Admin tarafından susturuldu" } as any);
    toast.success("Kullanıcı susturuldu (6 saat)");
    fetchAll(true);
  };

  const handleSuspendUser = async (userId: string) => {
    const { error } = await supabase.from("profiles").update({
      is_suspended: true, suspended_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    } as any).eq("user_id", userId);
    if (error) { toast.error("Askıya alma başarısız"); return; }
    await supabase.from("moderation_logs").insert({ user_id: userId, action: "suspend", admin_id: user?.id, reason: "Admin tarafından askıya alındı" } as any);
    toast.success("Kullanıcı askıya alındı (7 gün)");
    fetchAll(true);
  };

  const handleUnmuteUser = async (userId: string) => {
    await supabase.from("profiles").update({ is_muted: false, muted_until: null } as any).eq("user_id", userId);
    await supabase.from("moderation_logs").insert({ user_id: userId, action: "unmute", admin_id: user?.id, reason: "Admin tarafından susturma kaldırıldı" } as any);
    toast.success("Susturma kaldırıldı");
    fetchAll(true);
  };

  const handleUnsuspendUser = async (userId: string) => {
    await supabase.from("profiles").update({ is_suspended: false, suspended_until: null } as any).eq("user_id", userId);
    await supabase.from("moderation_logs").insert({ user_id: userId, action: "unsuspend", admin_id: user?.id, reason: "Admin tarafından askı kaldırıldı" } as any);
    toast.success("Askı kaldırıldı");
    fetchAll(true);
  };

  const handleClearScore = async (userId: string) => {
    await supabase.from("profiles").update({ moderation_score: 0, is_muted: false, muted_until: null, is_suspended: false, suspended_until: null } as any).eq("user_id", userId);
    await supabase.from("moderation_logs").insert({ user_id: userId, action: "clear_warning", admin_id: user?.id, reason: "Admin tarafından skor sıfırlandı" } as any);
    toast.success("Moderasyon skoru sıfırlandı");
    fetchAll(true);
  };

  const handleToggleAdmin = async (userId: string) => {
    const currentRole = getUserRole(userId);
    if (userId === user?.id) { toast.error("Kendi admin rolünüzü kaldıramazsınız"); return; }
    if (currentRole === "admin") {
      if (!confirm("Bu kullanıcının admin rolünü kaldırmak istediğinizden emin misiniz?")) return;
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      if (error) toast.error("Rol kaldırılamadı"); else { toast.success("Admin rolü kaldırıldı"); fetchAll(true); }
    } else {
      if (!confirm("Bu kullanıcıya admin rolü vermek istediğinizden emin misiniz?")) return;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) toast.error("Rol verilemedi"); else { toast.success("Admin rolü verildi"); fetchAll(true); }
    }
  };

  const handleModAction = async (itemId: string, action: string, note?: string) => {
    const { error } = await supabase.from("moderation_queue").update({
      status: action, admin_action: action, admin_note: note || null, reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
    } as any).eq("id", itemId);
    if (error) toast.error("İşlem başarısız");
    else { toast.success("Moderasyon işlemi uygulandı"); fetchAll(true); }
  };

  const handleMuteReportedUser = async (report: any, note: string) => {
    const targetUserId = getReportTargetUserId(report);
    await handleMuteUser(targetUserId);
    await handleUpdateReport(report.id, "resolved", note || "Kullanıcı susturuldu.");
  };

  const handleSuspendReportedUser = async (report: any, note: string) => {
    const targetUserId = getReportTargetUserId(report);
    await handleSuspendUser(targetUserId);
    await handleUpdateReport(report.id, "resolved", note || "Kullanıcı askıya alındı.");
  };

  const handleRemoveAvatar = async (report: any, note: string) => {
    await supabase.from("profiles").update({ avatar_url: null } as any).eq("user_id", report.target_id);
    await supabase.from("moderation_logs").insert({ user_id: report.target_id, action: "avatar_removed", admin_id: user?.id, reason: note || "Avatar kaldırıldı" } as any);
    await handleUpdateReport(report.id, "resolved", note || "Avatar kaldırıldı.");
    toast.success("Avatar kaldırıldı");
  };

  // ─── Suggestion Handlers ───
  const handleApproveSuggestion = async (suggestion: any) => {
    if (suggestion.type === "department") {
      toast.error("Bolum onerileri admin kuyrugunda islenmez.");
      return;
    }
    if (suggestion.type === "info_change") {
      const targetUserId = suggestion.user_id;
      const newUni = (suggestion.university || "").trim() || null;
      const newDept = (suggestion.department || "").trim() || null;
      const newYear = suggestion.class_year ? parseInt(suggestion.class_year) : null;
      const { error: rpcError } = await supabase.rpc("admin_update_academic_info", { p_target_user_id: targetUserId, p_university: newUni, p_department: newDept, p_class_year: newYear });
      if (rpcError) { toast.error("Güncellenemedi: " + rpcError.message); return; }
      await supabase.from("notifications").insert({ user_id: targetUserId, type: "system", title: "Akademik bilgi değişiklik talebiniz onaylandı", message: `Yeni: ${newUni || "—"} / ${newDept || "—"} / ${newYear !== null ? (newYear === 0 ? "Hazırlık" : newYear + ". Sınıf") : "—"}`, link: "/settings" });
      await supabase.from("academic_suggestions").update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString(), admin_note: "Akademik bilgiler güncellendi" } as any).eq("id", suggestion.id);
      toast.success("Akademik bilgi değişikliği onaylandı!"); fetchAll(true); return;
    }
    if (suggestion.type === "course" && suggestion.course_name) {
      const deptName = (suggestion.department || "").trim();
      if (deptName) {
        await supabase.from("departments" as any).upsert({ university: suggestion.university, name: deptName, faculty: suggestion.faculty || null, created_by: suggestion.user_id }, { onConflict: "university,name_normalized" });
      }
      const insertRes = await supabase.from("courses").insert({ name: suggestion.normalized_name || suggestion.course_name, code: suggestion.course_code || null, university: suggestion.university, department: suggestion.department, year: suggestion.class_year ? parseInt(suggestion.class_year) : 1 } as any).select("id").maybeSingle();
      if (insertRes.error) { toast.error("Ders eklenemedi: " + insertRes.error.message); return; }
      await supabase.from("academic_suggestions").update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString(), inserted_id: (insertRes.data as any)?.id ?? null } as any).eq("id", suggestion.id);
      toast.success("Ders onaylandı!"); fetchAll(true); return;
    }
    await supabase.from("academic_suggestions").update({ status: "approved", reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any).eq("id", suggestion.id);
    toast.success("Öneri onaylandı!"); fetchAll(true);
  };

  const handleRejectSuggestion = async (suggestion: any, note?: string) => {
    if (suggestion.inserted_id) {
      if (suggestion.type === "department") {
        const { data: relatedCourses } = await supabase.from("courses").select("id").eq("university", suggestion.university).eq("department", suggestion.department || suggestion.normalized_name).limit(1);
        if (!relatedCourses || relatedCourses.length === 0) {
          await supabase.from("departments" as any).delete().eq("id", suggestion.inserted_id);
        }
      } else if (suggestion.type === "course") {
        const { data: relatedPosts } = await supabase.from("posts").select("id").eq("course_id", suggestion.inserted_id);
        if (relatedPosts && relatedPosts.length > 0) {
          const postIds = relatedPosts.map((p: any) => p.id);
          const { data: postComments } = await supabase.from("comments").select("id").in("post_id", postIds);
          if (postComments && postComments.length > 0) await supabase.from("comment_likes").delete().in("comment_id", postComments.map((c: any) => c.id));
          await supabase.from("comments").delete().in("post_id", postIds);
          await supabase.from("votes").delete().in("post_id", postIds);
          await supabase.from("bookmarks").delete().in("post_id", postIds);
          await supabase.from("post_downloads").delete().in("post_id", postIds);
          await supabase.from("posts").delete().in("id", postIds);
        }
        await supabase.from("course_resources").delete().eq("course_id", suggestion.inserted_id);
        await supabase.from("course_wikis").delete().eq("course_id", suggestion.inserted_id);
        await supabase.from("courses").delete().eq("id", suggestion.inserted_id);
      }
    }
    await supabase.from("academic_suggestions").update({ status: "rejected", admin_note: note || "Admin tarafından reddedildi", reviewed_by: user?.id, reviewed_at: new Date().toISOString() } as any).eq("id", suggestion.id);
    toast.success("Öneri reddedildi"); fetchAll(true);
  };

  const handleApproveAcademicProgramRequest = async (request: any) => {
    const { data, error } = await supabase.rpc("admin_process_academic_program_request", {
      p_request_id: request.id,
      p_action: "approved",
    } as any);

    if (!error && data?.ok) {
      toast.success("Program talebi onaylandı ve canonical kataloğa işlendi.");
      fetchAll(true);
      return;
    }

    if (error && !isMissingFunctionError(error)) {
      toast.error("Talep işlenemedi: " + error.message);
      return;
    }

    const finalProgramName = (request.requested_program_name || "").trim();
    const finalProgramLevel = (request.requested_program_level || "lisans").trim();
    const finalUnitName = (request.requested_unit_name || "").trim() || null;
    const finalProgramYears = finalProgramLevel === "onlisans" ? 2 : 4;

    const { data: upsertedProgram, error: upsertErr } = await supabase.from("academic_programs" as any).upsert({
      university_id: request.university_id,
      university_name: request.university_name,
      program_name: finalProgramName,
      unit_name: finalUnitName,
      unit_type: finalUnitName?.toLocaleLowerCase("tr-TR").includes("fakülte") ? "fakulte" : "diger",
      program_level: finalProgramLevel,
      program_years: finalProgramYears,
      source: "request",
      is_active: true,
      created_by: user?.id || null,
    }, { onConflict: "university_id,program_name_normalized,program_level" }).select("id").maybeSingle();

    if (upsertErr) {
      toast.error("Program kataloğa işlenemedi: " + upsertErr.message);
      return;
    }

    await supabase.from("departments" as any).upsert({
      university: request.university_name,
      name: finalProgramName,
      faculty: finalUnitName,
      program_years: finalProgramYears,
      created_by: user?.id || null,
    }, { onConflict: "university,name_normalized" });

    const { error: updateErr } = await supabase.from("academic_program_requests" as any).update({
      status: "approved",
      admin_program_name: finalProgramName,
      admin_program_level: finalProgramLevel,
      admin_unit_name: finalUnitName,
      admin_program_years: finalProgramYears,
      inserted_program_id: upsertedProgram?.id || null,
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", request.id);

    if (updateErr) {
      toast.error("Talep güncellenemedi: " + updateErr.message);
      return;
    }

    toast.success("Program talebi onaylandı.");
    fetchAll(true);
  };

  const handleRejectAcademicProgramRequest = async (request: any) => {
    const { data, error } = await supabase.rpc("admin_process_academic_program_request", {
      p_request_id: request.id,
      p_action: "rejected",
      p_admin_note: "Admin tarafından reddedildi",
    } as any);

    if (!error && data?.ok) {
      toast.success("Program talebi reddedildi.");
      fetchAll(true);
      return;
    }

    if (error && !isMissingFunctionError(error)) {
      toast.error("Talep reddedilemedi: " + error.message);
      return;
    }

    const { error: updateErr } = await supabase.from("academic_program_requests" as any).update({
      status: "rejected",
      admin_note: "Admin tarafından reddedildi",
      reviewed_by: user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", request.id);

    if (updateErr) {
      toast.error("Talep reddedilemedi: " + updateErr.message);
      return;
    }

    toast.success("Program talebi reddedildi.");
    fetchAll(true);
  };
  const handleApproveDomainRequest = async (request: any) => {
    const draft = getDomainDraft(request);
    const universityName = (draft.university_name || "").trim();
    const domain = (draft.domain || "").trim().toLowerCase();
    if (!universityName) {
      toast.error("Universite adi zorunlu.");
      return;
    }
    if (!domain) {
      toast.error("Domain zorunlu.");
      return;
    }
    const { data: rpcData, error } = await supabase.rpc("admin_process_university_domain_request", {
      p_request_id: request.id,
      p_action: "approved",
      p_university_name: universityName,
      p_country: draft.country,
      p_domain: domain,
      p_city: draft.city.trim() || null,
      p_type: draft.type.trim() || null,
      p_admin_note: draft.admin_note.trim() || null,
      p_seed_general_department: draft.seed_general_department,
    } as any);
    if (!error && rpcData) {
      toast.success("Domain talebi onaylandi ve sisteme eklendi.");
      fetchAll(true);
      return;
    }

    if (error && !isMissingFunctionError(error)) {
      toast.error("Talep onaylanamadi: " + error.message);
      return;
    }

    const { data: uniRow, error: uniErr } = await supabase
      .from("universities" as any)
      .upsert({
        name: universityName,
        country: draft.country,
        city: draft.city.trim() || null,
        type: draft.type.trim() || null,
        created_by: user?.id || null,
      }, { onConflict: "name" })
      .select("id")
      .maybeSingle();
    if (uniErr || !uniRow?.id) {
      toast.error("Universite eklenemedi: " + (uniErr?.message || "Bilinmeyen hata"));
      return;
    }

    const { error: domainErr } = await supabase
      .from("university_email_domains" as any)
      .upsert({
        university_id: uniRow.id,
        domain,
        is_primary: true,
        is_verified: true,
      }, { onConflict: "domain" });
    if (domainErr) {
      toast.error("Domain eklenemedi: " + domainErr.message);
      return;
    }

    if (draft.seed_general_department) {
      await supabase.from("departments" as any).upsert({
        university: universityName,
        name: "Genel",
        created_by: user?.id || null,
      }, { onConflict: "university,name_normalized" });
    }

    const { error: reqErr } = await supabase
      .from("university_domain_requests" as any)
      .update({
        status: "approved",
        admin_note: draft.admin_note.trim() || null,
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
        resolved_university_id: uniRow.id,
        resolved_domain: domain,
      })
      .eq("id", request.id);
    if (reqErr) {
      toast.error("Talep güncellenemedi: " + reqErr.message);
      return;
    }

    toast.success("Domain talebi onaylandi ve sisteme eklendi.");
    fetchAll(true);
  };

  const handleRejectDomainRequest = async (request: any) => {
    const draft = getDomainDraft(request);
    const { data: rpcData, error } = await supabase.rpc("admin_process_university_domain_request", {
      p_request_id: request.id,
      p_action: "rejected",
      p_admin_note: draft.admin_note.trim() || "Admin tarafindan reddedildi",
    } as any);
    if (!error && rpcData) {
      toast.success("Domain talebi reddedildi.");
      fetchAll(true);
      return;
    }
    if (error && !isMissingFunctionError(error)) {
      toast.error("Talep reddedilemedi: " + error.message);
      return;
    }

    const { error: fallbackErr } = await supabase
      .from("university_domain_requests" as any)
      .update({
        status: "rejected",
        admin_note: draft.admin_note.trim() || "Admin tarafindan reddedildi",
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);
    if (fallbackErr) {
      toast.error("Talep reddedilemedi: " + fallbackErr.message);
      return;
    }

    toast.success("Domain talebi reddedildi.");
    fetchAll(true);
  };

  // Support
  const handleReplyTicket = async (ticketId: string, reply: string) => {
    if (!reply.trim()) return;
    const ticket = supportTickets.find((t: any) => t.id === ticketId);
    const { error } = await supabase.from("support_tickets").update({ admin_reply: reply.trim(), status: "replied", replied_by: user?.id, replied_at: new Date().toISOString() } as any).eq("id", ticketId);
    if (error) { toast.error("Yanıt gönderilemedi"); return; }
    if (ticket) {
      await supabase.from("notifications").insert({ user_id: ticket.user_id, type: "system", title: "Destek talebinize yanıt verildi", message: `"${(ticket.subject || "").substring(0, 50)}" konulu talebinize yanıt verildi.`, link: "/settings" });
    }
    toast.success("Yanıt gönderildi"); fetchAll(true);
  };

  const handleCloseTicket = async (ticketId: string) => {
    const { error } = await supabase.from("support_tickets").update({ status: "closed" } as any).eq("id", ticketId);
    if (error) toast.error("Kapatılamadı");
    else { toast.success("Talep kapatıldı"); fetchAll(true); }
  };

  // ─── Universities list ───
  const allUniversities = useMemo(() => {
    return [...new Set([
      ...universitiesCatalog.map((u: any) => u.name).filter(Boolean),
      ...courses.map((c: any) => c.university).filter(Boolean),
      ...departments.map((d: any) => d.university).filter(Boolean),
      ...users.map((u: any) => u.university).filter(Boolean),
    ])].sort((a, b) => a.localeCompare(b, "tr"));
  }, [universitiesCatalog, courses, departments, users]);

  // Security event types
  const securityEventTypes = useMemo(() => {
    const types = new Set(securityLogs.map((l: any) => l.event_type));
    return ["all", ...Array.from(types).sort()];
  }, [securityLogs]);

  if (authLoading || !isAdmin) return null;

  return (
    <Layout>
      <div className="mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-extrabold">Yönetici Paneli</h1>
              <p className="text-xs text-muted-foreground">Platform yönetimi ve moderasyon merkezi</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => fetchAll(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Yenile
          </Button>
        </div>

        {/* Quick action badges */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {stats.pendingMod > 0 && (
            <Badge variant="destructive" className="cursor-pointer text-xs py-1 px-2.5" onClick={() => { setActiveTab("moderation"); setModQueueFilter("flagged"); }}>
              <ShieldAlert className="h-3 w-3 mr-1" /> {stats.pendingMod} moderasyon bekliyor
            </Badge>
          )}
          {stats.pendingReports > 0 && (
            <Badge variant="destructive" className="cursor-pointer text-xs py-1 px-2.5" onClick={() => { setActiveTab("reports"); setReportStatusFilter("pending"); }}>
              <Flag className="h-3 w-3 mr-1" /> {stats.pendingReports} rapor bekliyor
            </Badge>
          )}
          {stats.pendingSuggestions > 0 && (
            <Badge className="cursor-pointer text-xs py-1 px-2.5 bg-amber-500/10 text-amber-600 border border-amber-300" onClick={() => { setActiveTab("suggestions"); setSuggestionFilter("pending"); }}>
              <GraduationCap className="h-3 w-3 mr-1" /> {stats.pendingSuggestions} öneri bekliyor
            </Badge>
          )}
          {stats.openTickets > 0 && (
            <Badge className="cursor-pointer text-xs py-1 px-2.5 bg-blue-500/10 text-blue-600 border border-blue-300" onClick={() => setActiveTab("support")}>
              <CircleAlert className="h-3 w-3 mr-1" /> {stats.openTickets} destek talebi
            </Badge>
          )}
          {stats.suspendedUsers > 0 && (
            <Badge variant="outline" className="cursor-pointer text-xs py-1 px-2.5 text-destructive" onClick={() => { setActiveTab("users"); setUserStatusFilter("suspended"); }}>
              <Ban className="h-3 w-3 mr-1" /> {stats.suspendedUsers} askıda
            </Badge>
          )}
          {stats.mutedUsers > 0 && (
            <Badge variant="outline" className="cursor-pointer text-xs py-1 px-2.5 text-amber-600" onClick={() => { setActiveTab("users"); setUserStatusFilter("muted"); }}>
              <VolumeX className="h-3 w-3 mr-1" /> {stats.mutedUsers} susturulmuş
            </Badge>
          )}
        </div>

        <div className="flex gap-6">
          {/* Sidebar nav */}
          <nav className="hidden md:flex flex-col gap-1 w-48 shrink-0">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const badgeCount = key === "reports" ? pendingReportsCount : key === "moderation" ? pendingModCount : key === "suggestions" ? pendingSuggestionsCount : key === "support" ? openTicketsCount : 0;
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${activeTab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                  {badgeCount > 0 && <Badge variant="destructive" className="ml-auto text-[9px] h-4 px-1.5">{badgeCount}</Badge>}
                </button>
              );
            })}
          </nav>

          {/* Mobile nav */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t p-2 flex gap-1 overflow-x-auto">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors min-w-[56px] ${activeTab === key ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0 pb-20 md:pb-0">
            {dataLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* ═══ STATS ═══ */}
                {activeTab === "stats" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      <StatCard icon={Users} label="Toplam Kullanıcı" value={stats.totalUsers} color="text-primary" onClick={() => setActiveTab("users")} />
                      <StatCard icon={Building2} label="Üniversite" value={stats.totalUniversities} color="text-green-600" />
                      <StatCard icon={GraduationCap} label="Bölüm" value={stats.totalDepartments} color="text-blue-600" />
                      <StatCard icon={BookOpen} label="Ders" value={stats.totalCourses} color="text-purple-600" onClick={() => setActiveTab("courses")} />
                      <StatCard icon={FileText} label="Toplam Gönderi" value={stats.totalPosts} color="text-foreground" onClick={() => setActiveTab("posts")} />
                      <StatCard icon={MessageSquare} label="Toplam Yorum" value={stats.totalComments} color="text-indigo-500" onClick={() => setActiveTab("comments")} />
                      <StatCard icon={Flag} label="Bekleyen Rapor" value={stats.pendingReports} color="text-destructive" onClick={() => { setActiveTab("reports"); setReportStatusFilter("pending"); }} />
                      <StatCard icon={ShieldAlert} label="Moderasyon" value={stats.pendingMod} color="text-amber-500" onClick={() => { setActiveTab("moderation"); setModQueueFilter("flagged"); }} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Card className="p-3 text-center">
                        <p className="text-lg font-extrabold">{stats.contentCounts.notes}</p>
                        <p className="text-[11px] text-muted-foreground">Not</p>
                      </Card>
                      <Card className="p-3 text-center">
                        <p className="text-lg font-extrabold">{stats.contentCounts.past_exams}</p>
                        <p className="text-[11px] text-muted-foreground">Çıkmış Soru</p>
                      </Card>
                      <Card className="p-3 text-center">
                        <p className="text-lg font-extrabold">{stats.contentCounts.discussion}</p>
                        <p className="text-[11px] text-muted-foreground">Tartışma</p>
                      </Card>
                      <Card className="p-3 text-center">
                        <p className="text-lg font-extrabold">{stats.contentCounts.kaynaklar}</p>
                        <p className="text-[11px] text-muted-foreground">Kaynak</p>
                      </Card>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> En Aktif Dersler</h3>
                        {stats.topCourses.length === 0 ? <p className="text-xs text-muted-foreground">Henüz veri yok.</p> : (
                          <div className="space-y-2">
                            {stats.topCourses.map((c, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-sm truncate">{c.code && <span className="text-muted-foreground mr-1">{c.code}</span>}{c.name}</span>
                                <Badge variant="secondary" className="text-[10px]">{c.count} gönderi</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                      <Card className="p-4">
                        <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Star className="h-4 w-4 text-primary" /> En Aktif Kullanıcılar</h3>
                        {stats.topUsers.length === 0 ? <p className="text-xs text-muted-foreground">Henüz veri yok.</p> : (
                          <div className="space-y-2">
                            {stats.topUsers.map((u, i) => (
                              <div key={i} className="flex items-center justify-between">
                                <span className="text-sm">{u.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px]">{u.rep} puan</Badge>
                                  <Badge variant="secondary" className="text-[10px]">{u.count} gönderi</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </div>

                    {/* User status overview */}
                    <Card className="p-4">
                      <h3 className="text-sm font-bold mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Kullanıcı Durumları</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg" onClick={() => { setActiveTab("users"); setUserStatusFilter("active"); }}>
                          <p className="text-lg font-extrabold text-green-600">{stats.totalUsers - stats.mutedUsers - stats.suspendedUsers}</p>
                          <p className="text-[11px] text-muted-foreground">Aktif</p>
                        </div>
                        <div className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg" onClick={() => { setActiveTab("users"); setUserStatusFilter("muted"); }}>
                          <p className="text-lg font-extrabold text-amber-500">{stats.mutedUsers}</p>
                          <p className="text-[11px] text-muted-foreground">Susturulmuş</p>
                        </div>
                        <div className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg" onClick={() => { setActiveTab("users"); setUserStatusFilter("suspended"); }}>
                          <p className="text-lg font-extrabold text-destructive">{stats.suspendedUsers}</p>
                          <p className="text-[11px] text-muted-foreground">Askıda</p>
                        </div>
                        <div className="text-center cursor-pointer hover:bg-muted/50 p-2 rounded-lg" onClick={() => { setActiveTab("users"); setUserStatusFilter("flagged"); }}>
                          <p className="text-lg font-extrabold text-amber-600">{stats.flaggedUsers}</p>
                          <p className="text-[11px] text-muted-foreground">Uyarılı</p>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* ═══ USERS ═══ */}
                {activeTab === "users" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <SearchBar value={userSearch} onChange={(v) => { setUserSearch(v); setUserPage(0); }} placeholder="Kullanıcı ara (isim, üniversite, bölüm, ID)..." />
                      </div>
                      <div className="flex gap-2">
                        <Select value={userStatusFilter} onValueChange={(v) => { setUserStatusFilter(v); setUserPage(0); }}>
                          <SelectTrigger className="w-36 h-9 text-xs"><SelectValue placeholder="Durum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tüm Durumlar</SelectItem>
                            <SelectItem value="active">Aktif</SelectItem>
                            <SelectItem value="muted">Susturulmuş</SelectItem>
                            <SelectItem value="suspended">Askıda</SelectItem>
                            <SelectItem value="flagged">Uyarılı</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={userRoleFilter} onValueChange={(v) => { setUserRoleFilter(v); setUserPage(0); }}>
                          <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="Rol" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tüm Roller</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="user">Kullanıcı</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Kullanıcı</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Üniversite</TableHead>
                              <TableHead className="text-xs hidden md:table-cell">Bölüm</TableHead>
                              <TableHead className="text-xs">Durum</TableHead>
                              <TableHead className="text-xs">Rol</TableHead>
                              <TableHead className="text-xs text-right">Puan</TableHead>
                              <TableHead className="text-xs text-right">İşlem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(filteredUsers, userPage).map((u: any) => (
                              <TableRow key={u.id}>
                                <TableCell className="py-2">
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-7 w-7">
                                      {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                                      <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                        {(u.username || "?")[0].toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <span className="text-sm font-medium truncate max-w-[120px] block">{u.username || "Anonim"}</span>
                                      {u.display_name && u.display_name !== u.username && (
                                        <span className="text-[10px] text-muted-foreground">{u.display_name}</span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  {u.university ? (
                                    <div className="leading-tight">
                                      <p className="text-xs text-foreground">{u.university}</p>
                                      <p className="text-[10px] text-muted-foreground">{getUniversityMetaLabel(u.university)}</p>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{u.department || "—"}</TableCell>
                                <TableCell><UserStatusBadges user={u} /></TableCell>
                                <TableCell>
                                  <Badge variant={getUserRole(u.user_id) === "admin" ? "destructive" : "outline"} className="text-[10px]">
                                    {getUserRole(u.user_id)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-medium">{u.reputation_points ?? 0}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-0.5">
                                    {u.is_muted && (
                                      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5 text-amber-600" onClick={() => handleUnmuteUser(u.user_id)} title="Susturmayı Kaldır">
                                        <VolumeX className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {u.is_suspended && (
                                      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5 text-destructive" onClick={() => handleUnsuspendUser(u.user_id)} title="Askıyı Kaldır">
                                        <Ban className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {!u.is_muted && !u.is_suspended && (
                                      <>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500" onClick={() => handleMuteUser(u.user_id)} title="Sustur">
                                          <VolumeX className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleSuspendUser(u.user_id)} title="Askıya Al">
                                          <Ban className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                    {(u.moderation_score || 0) > 0 && (
                                      <Button variant="ghost" size="sm" className="h-7 text-[10px] px-1.5 text-primary" onClick={() => handleClearScore(u.user_id)} title="Skoru Sıfırla">
                                        <RefreshCw className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {u.user_id !== user?.id && (
                                      <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${getUserRole(u.user_id) === "admin" ? "text-destructive" : "text-primary"}`}
                                        onClick={() => handleToggleAdmin(u.user_id)} title={getUserRole(u.user_id) === "admin" ? "Admin kaldır" : "Admin yap"}>
                                        {getUserRole(u.user_id) === "admin" ? <XCircle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                      </Button>
                                    )}
                                    <UserDetailDialog user={u} role={getUserRole(u.user_id)} postCount={posts.filter((p: any) => p.user_id === u.user_id).length} commentCount={comments.filter((c: any) => c.user_id === u.user_id).length} onDeleted={() => fetchAll(true)} />
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {filteredUsers.length === 0 && (
                              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Kullanıcı bulunamadı.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={userPage} setPage={setUserPage} total={filteredUsers.length} />
                    </Card>
                  </div>
                )}

                {/* ═══ MODERATION ═══ */}
                {activeTab === "moderation" && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <SearchBar value={modSearch} onChange={(v) => { setModSearch(v); setModQueuePage(0); }} placeholder="Moderasyon ara (içerik, ihlal, kullanıcı)..." />
                      </div>
                      <Select value={modQueueFilter} onValueChange={(v) => { setModQueueFilter(v); setModQueuePage(0); }}>
                        <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          <SelectItem value="flagged">İşaretli</SelectItem>
                          <SelectItem value="blocked">Engellenen</SelectItem>
                          <SelectItem value="approved">Onaylanan</SelectItem>
                          <SelectItem value="false_positive">Yanlış Alarm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">İçerik</TableHead>
                              <TableHead className="text-xs">Tür</TableHead>
                              <TableHead className="text-xs">İhlal</TableHead>
                              <TableHead className="text-xs">Şiddet</TableHead>
                              <TableHead className="text-xs">Durum</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Kullanıcı</TableHead>
                              <TableHead className="text-xs text-right">İşlem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(filteredModQueue, modQueuePage).map((item: any) => (
                              <TableRow key={item.id}>
                                <TableCell className="py-2">
                                  <p className="text-xs line-clamp-2 max-w-[200px]">{item.content_text || (item.content_url ? "ğŸ–¼ï¸ Görsel" : "—")}</p>
                                </TableCell>
                                <TableCell><Badge variant="outline" className="text-[10px]">{item.content_type}</Badge></TableCell>
                                <TableCell><Badge variant="secondary" className="text-[10px]">{item.violation_type}</Badge></TableCell>
                                <TableCell>
                                  <Badge variant={item.severity === "high" || item.severity === "critical" ? "destructive" : item.severity === "medium" ? "secondary" : "outline"} className="text-[10px]">
                                    {item.severity}
                                  </Badge>
                                </TableCell>
                                <TableCell><StatusBadge status={item.status} /></TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{getUsername(item.user_id)}</TableCell>
                                <TableCell className="text-right">
                                  {(item.status === "flagged" || item.status === "blocked") && (
                                    <div className="flex items-center justify-end gap-1">
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => handleModAction(item.id, "approved")} title="Onayla">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleModAction(item.id, "false_positive")} title="Yanlış Alarm">
                                        <XCircle className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-500" onClick={() => handleMuteUser(item.user_id)} title="Sustur">
                                        <VolumeX className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleSuspendUser(item.user_id)} title="Askıya Al">
                                        <Ban className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            {filteredModQueue.length === 0 && (
                              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Moderasyon kuyruğu boş.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={modQueuePage} setPage={setModQueuePage} total={filteredModQueue.length} />
                    </Card>

                    {/* Mod Logs */}
                    <h3 className="text-sm font-bold pt-2">Moderasyon Geçmişi</h3>
                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Tarih</TableHead>
                              <TableHead className="text-xs">İşlem</TableHead>
                              <TableHead className="text-xs">Kullanıcı</TableHead>
                              <TableHead className="text-xs">Neden</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(moderationLogs, modLogPage).map((log: any) => (
                              <TableRow key={log.id}>
                                <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={["suspend", "mute", "suspended", "muted"].includes(log.action) ? "destructive" : "outline"} className="text-[10px]">
                                    {log.action}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{getUsername(log.user_id)}</TableCell>
                                <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">{log.reason || "—"}</TableCell>
                              </TableRow>
                            ))}
                            {moderationLogs.length === 0 && (
                              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Moderasyon geçmişi boş.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={modLogPage} setPage={setModLogPage} total={moderationLogs.length} />
                    </Card>
                  </div>
                )}

                {/* ═══ SUGGESTIONS ═══ */}
                {activeTab === "suggestions" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Select value={suggestionFilter} onValueChange={setSuggestionFilter}>
                        <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          <SelectItem value="pending">Bekleyen</SelectItem>
                          <SelectItem value="approved">Onaylanan</SelectItem>
                          <SelectItem value="rejected">Reddedilen</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground">{filteredSuggestions.length + filteredAcademicProgramRequests.length} öğe</span>
                    </div>
                    {filteredSuggestions.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Öneri bulunamadı.</Card>}
                    {filteredSuggestions.map((s: any) => (
                      <Card key={s.id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{s.type === "department" ? "Bölüm" : s.type === "info_change" ? "Bilgi Değişikliği" : s.type === "university" ? "Üniversite" : "Ders"}</Badge>
                            <StatusBadge status={s.status} />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: tr })}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><p className="text-[10px] text-muted-foreground">Üniversite</p><p className="font-medium">{s.university}</p></div>
                          {s.department && <div><p className="text-[10px] text-muted-foreground">Bölüm</p><p className="font-medium">{s.department}</p></div>}
                          {s.course_name && <div><p className="text-[10px] text-muted-foreground">Ders</p><p className="font-medium">{s.course_name}</p></div>}
                          {s.course_code && <div><p className="text-[10px] text-muted-foreground">Kod</p><p className="font-medium">{s.course_code}</p></div>}
                          {s.class_year && <div><p className="text-[10px] text-muted-foreground">Sınıf</p><p className="font-medium">{s.class_year === "0" || s.class_year === 0 ? "Hazırlık" : `${s.class_year}. Sınıf`}</p></div>}
                          <div><p className="text-[10px] text-muted-foreground">Öneren</p><p className="font-medium">{getUsername(s.user_id)}</p></div>
                        </div>
                        {s.ai_reason && <p className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded">AI: {s.ai_reason} (güven: {Math.round((s.ai_confidence || 0) * 100)}%)</p>}
                        {s.explanation && <p className="text-xs text-muted-foreground">Açıklama: {s.explanation}</p>}
                        {s.admin_note && <p className="text-xs text-muted-foreground bg-primary/5 p-2 rounded">Admin notu: {s.admin_note}</p>}
                        {s.status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => handleApproveSuggestion(s)}>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Onayla
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => handleRejectSuggestion(s)}>
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reddet
                            </Button>
                          </div>
                        )}
                      </Card>
                    ))}

                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 py-2">
                        <h3 className="text-sm font-bold">Bölüm/Program Request Talepleri</h3>
                        <span className="text-xs text-muted-foreground">{filteredAcademicProgramRequests.length} talep</span>
                      </div>

                      {filteredAcademicProgramRequests.length === 0 && (
                        <Card className="p-6 text-center text-sm text-muted-foreground">Program talebi bulunamadı.</Card>
                      )}

                      {filteredAcademicProgramRequests.map((r: any) => (
                        <Card key={r.id} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">Program Talebi</Badge>
                              <StatusBadge status={r.status} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: tr })}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Üniversite</p>
                              <p className="font-medium">{r.university_name}</p>
                              <p className="text-[10px] text-muted-foreground">{getUniversityMetaLabel(r.university_name)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Program</p>
                              <p className="font-medium">{r.requested_program_name}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Seviye</p>
                              <p className="font-medium">{r.requested_program_level === "onlisans" ? "Önlisans" : "Lisans"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Fakülte/Yüksekokul</p>
                              <p className="font-medium">{r.requested_unit_name || "-"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Kaynak</p>
                              <p className="font-medium">{r.request_context === "signup" ? "Signup" : "İçerik Ekle"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Talep Eden</p>
                              <p className="font-medium">{r.requester_user_id ? getUsername(r.requester_user_id) : (r.requester_email || "Anonim")}</p>
                            </div>
                          </div>

                          {r.request_note && <p className="text-xs text-muted-foreground">Not: {r.request_note}</p>}
                          {r.admin_note && <p className="text-xs text-muted-foreground bg-primary/5 p-2 rounded">Admin notu: {r.admin_note}</p>}

                          {r.status === "pending" && (
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => handleApproveAcademicProgramRequest(r)}>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Onayla ve Kataloğa İşle
                              </Button>
                              <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => handleRejectAcademicProgramRequest(r)}>
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reddet
                              </Button>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>

                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 py-2">
                        <h3 className="text-sm font-bold">Unknown Domain Talepleri</h3>
                        <Select value={domainRequestFilter} onValueChange={setDomainRequestFilter}>
                          <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tumu</SelectItem>
                            <SelectItem value="pending">Bekleyen</SelectItem>
                            <SelectItem value="approved">Onaylanan</SelectItem>
                            <SelectItem value="rejected">Reddedilen</SelectItem>
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">{filteredDomainRequests.length} talep</span>
                      </div>

                      {filteredDomainRequests.length === 0 && (
                        <Card className="p-6 text-center text-sm text-muted-foreground">Domain talebi bulunamadi.</Card>
                      )}

                      {filteredDomainRequests.map((r: any) => {
                        const draft = getDomainDraft(r);
                        return (
                          <Card key={r.id} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">Domain Talebi</Badge>
                                <StatusBadge status={r.status} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: tr })}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                              <div>
                                <p className="text-[10px] text-muted-foreground">Talep E-posta</p>
                                <p className="font-medium">{r.request_email}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Domain</p>
                                <p className="font-medium">{r.request_email_domain}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Bildirilen Universite</p>
                                <p className="font-medium">{r.claimed_university_name}</p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground">Oneren</p>
                                <p className="font-medium">{r.requester_user_id ? getUsername(r.requester_user_id) : "Anonim"}</p>
                              </div>
                            </div>

                            {r.request_note && <p className="text-xs text-muted-foreground">Not: {r.request_note}</p>}

                            {r.status === "pending" ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Universite Adi</Label>
                                  <Input
                                    value={draft.university_name}
                                    onChange={(e) => updateDomainDraft(r, { university_name: e.target.value })}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Domain</Label>
                                  <Input
                                    value={draft.domain}
                                    onChange={(e) => updateDomainDraft(r, { domain: e.target.value.toLowerCase() })}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Ulke</Label>
                                  <Select value={draft.country} onValueChange={(v) => updateDomainDraft(r, { country: v as "TR" | "KKTC" })}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="TR">TR</SelectItem>
                                      <SelectItem value="KKTC">KKTC</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Universite Tipi (opsiyonel)</Label>
                                  <Input
                                    value={draft.type}
                                    onChange={(e) => updateDomainDraft(r, { type: e.target.value })}
                                    placeholder="devlet / vakif"
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Sehir (opsiyonel)</Label>
                                  <Input
                                    value={draft.city}
                                    onChange={(e) => updateDomainDraft(r, { city: e.target.value })}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Genel Bolum Eklenmesi</Label>
                                  <Select
                                    value={draft.seed_general_department ? "yes" : "no"}
                                    onValueChange={(v) => updateDomainDraft(r, { seed_general_department: v === "yes" })}
                                  >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="yes">Evet</SelectItem>
                                      <SelectItem value="no">Hayir</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                  <Label className="text-[10px] text-muted-foreground">Admin Notu</Label>
                                  <Textarea
                                    value={draft.admin_note}
                                    onChange={(e) => updateDomainDraft(r, { admin_note: e.target.value })}
                                    className="text-xs min-h-20"
                                  />
                                </div>
                                <div className="md:col-span-2 flex gap-2">
                                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => handleApproveDomainRequest(r)}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Onayla ve Ekle
                                  </Button>
                                  <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={() => handleRejectDomainRequest(r)}>
                                    <XCircle className="h-3.5 w-3.5 mr-1" /> Reddet
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <p>Onaylanan Domain: {r.resolved_domain || "-"}</p>
                                <p>Inceleyen: {r.reviewed_by ? getUsername(r.reviewed_by) : "-"}</p>
                                {r.admin_note && <p className="md:col-span-2">Admin Notu: {r.admin_note}</p>}
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ═══ SUPPORT ═══ */}
                {activeTab === "support" && (() => {
                  const openTickets = supportTickets.filter((t: any) => t.status === "open");
                  const closedTickets = supportTickets.filter((t: any) => t.status !== "open");
                  return (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold">Açık Destek Talepleri ({openTickets.length})</h3>
                      {openTickets.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Açık destek talebi yok.</Card>}
                      {openTickets.map((t: any) => (
                        <SupportTicketCard key={t.id} ticket={t} getUsername={getUsername} onReply={handleReplyTicket} onClose={handleCloseTicket} />
                      ))}
                      {closedTickets.length > 0 && (
                        <>
                          <h3 className="text-sm font-bold pt-4">Geçmiş Talepler ({closedTickets.length})</h3>
                          <Card className="overflow-hidden">
                            <ScrollArea className="max-h-[300px]">
                              <Table>
                                <TableHeader><TableRow>
                                  <TableHead className="text-xs">Konu</TableHead>
                                  <TableHead className="text-xs">Kullanıcı</TableHead>
                                  <TableHead className="text-xs">Durum</TableHead>
                                  <TableHead className="text-xs hidden sm:table-cell">Tarih</TableHead>
                                </TableRow></TableHeader>
                                <TableBody>
                                  {closedTickets.map((t: any) => (
                                    <TableRow key={t.id}>
                                      <TableCell className="text-xs font-medium max-w-[200px] truncate">{t.subject}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{getUsername(t.user_id)}</TableCell>
                                      <TableCell><StatusBadge status={t.status} /></TableCell>
                                      <TableCell className="text-[10px] text-muted-foreground hidden sm:table-cell">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: tr })}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </Card>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* ═══ COURSES ═══ */}
                {activeTab === "courses" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <SearchBar value={courseSearch} onChange={(v) => { setCourseSearch(v); setCoursePage(0); }} placeholder="Ders ara (ad, kod, bölüm)..." />
                      </div>
                      <Select value={courseUniFilter} onValueChange={(v) => { setCourseUniFilter(v); setCoursePage(0); }}>
                        <SelectTrigger className="w-48 h-9 text-xs"><SelectValue placeholder="Üniversite" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm Üniversiteler</SelectItem>
                          {allUniversities.map((u) => (
                            <SelectItem key={u} value={u}>
                              {`${u} (${getUniversityMetaLabel(u)})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <CourseFormDialog universities={allUniversities} courses={courses} departmentsCatalog={departments} onSaved={() => fetchAll(true)} />
                    </div>
                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Ders</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Üniversite</TableHead>
                              <TableHead className="text-xs hidden md:table-cell">Bölüm</TableHead>
                              <TableHead className="text-xs">Sınıf</TableHead>
                              <TableHead className="text-xs text-right">İşlemler</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(filteredCourses, coursePage).map((c: any) => (
                              <TableRow key={c.id}>
                                <TableCell className="py-2">
                                  <span className="text-sm font-medium">{c.name}</span>
                                  {c.code && <Badge variant="outline" className="ml-1.5 text-[10px]">{c.code}</Badge>}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <div className="leading-tight">
                                    <p className="text-xs text-foreground">{c.university}</p>
                                    <p className="text-[10px] text-muted-foreground">{getUniversityMetaLabel(c.university)}</p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden md:table-cell">{c.department}</TableCell>
                                <TableCell><Badge variant="secondary" className="text-[10px]">{c.year === 0 ? "Hazırlık" : `${c.year}. Sınıf`}</Badge></TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <CourseFormDialog course={c} universities={allUniversities} courses={courses} departmentsCatalog={departments} onSaved={() => fetchAll(true)} />
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteCourse(c.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {filteredCourses.length === 0 && (
                              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Ders bulunamadı.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={coursePage} setPage={setCoursePage} total={filteredCourses.length} />
                    </Card>
                  </div>
                )}

                {/* ═══ POSTS ═══ */}
                {activeTab === "posts" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <SearchBar value={postSearch} onChange={(v) => { setPostSearch(v); setPostPage(0); }} placeholder="Gönderi ara (başlık, içerik)..." />
                      </div>
                      <Select value={postTypeFilter} onValueChange={(v) => { setPostTypeFilter(v); setPostPage(0); }}>
                        <SelectTrigger className="w-32 h-9 text-xs"><SelectValue placeholder="Tür" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          <SelectItem value="notes">Notlar</SelectItem>
                          <SelectItem value="past_exams">Çıkmış</SelectItem>
                          <SelectItem value="discussion">Tartışma</SelectItem>
                          <SelectItem value="kaynaklar">Kaynak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Başlık</TableHead>
                              <TableHead className="text-xs">Tür</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Yazar</TableHead>
                              <TableHead className="text-xs hidden md:table-cell">Ders</TableHead>
                              <TableHead className="text-xs hidden lg:table-cell">Tarih</TableHead>
                              <TableHead className="text-xs text-right">İşlem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(filteredPosts, postPage).map((p: any) => (
                              <TableRow key={p.id}>
                                <TableCell className="py-2">
                                  <span className="text-sm font-medium line-clamp-1 max-w-[200px]">{p.title}</span>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px]">
                                    {({ notes: "Not", past_exams: "Çıkmış", discussion: "Tartışma", kaynaklar: "Kaynak" } as any)[p.content_type] || p.content_type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{p.is_anonymous ? "Anonim" : getUsername(p.user_id)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden md:table-cell truncate max-w-[120px]">{getCourseName(p.course_id)}</TableCell>
                                <TableCell className="text-[11px] text-muted-foreground hidden lg:table-cell">
                                  {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: tr })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                                      <a href={`/post/${p.id}`} target="_blank"><Eye className="h-3.5 w-3.5" /></a>
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeletePost(p.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {filteredPosts.length === 0 && (
                              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Gönderi bulunamadı.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={postPage} setPage={setPostPage} total={filteredPosts.length} />
                    </Card>
                  </div>
                )}

                {/* ═══ COMMENTS ═══ */}
                {activeTab === "comments" && (
                  <div className="space-y-3">
                    <SearchBar value={commentSearch} onChange={(v) => { setCommentSearch(v); setCommentPage(0); }} placeholder="Yorum ara (içerik)..." />
                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">İçerik</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Yazar</TableHead>
                              <TableHead className="text-xs hidden md:table-cell">Beğeni</TableHead>
                              <TableHead className="text-xs hidden lg:table-cell">Tarih</TableHead>
                              <TableHead className="text-xs text-right">İşlem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(filteredComments, commentPage).map((c: any) => (
                              <TableRow key={c.id}>
                                <TableCell className="py-2"><p className="text-sm line-clamp-2 max-w-[250px]">{c.content}</p></TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{c.is_anonymous ? "Anonim" : getUsername(c.user_id)}</TableCell>
                                <TableCell className="text-xs hidden md:table-cell">{c.like_count ?? 0}</TableCell>
                                <TableCell className="text-[11px] text-muted-foreground hidden lg:table-cell">
                                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: tr })}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteComment(c.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {filteredComments.length === 0 && (
                              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Yorum bulunamadı.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={commentPage} setPage={setCommentPage} total={filteredComments.length} />
                    </Card>
                  </div>
                )}

                {/* ═══ REPORTS ═══ */}
                {activeTab === "reports" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <SearchBar value={reportSearch} onChange={(v) => { setReportSearch(v); setReportPage(0); }} placeholder="Rapor ara (sebep, bildiren)..." />
                      </div>
                      <Select value={reportStatusFilter} onValueChange={(v) => { setReportStatusFilter(v); setReportPage(0); }}>
                        <SelectTrigger className="w-32 h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          <SelectItem value="pending">Bekleyen</SelectItem>
                          <SelectItem value="resolved">Çözülen</SelectItem>
                          <SelectItem value="dismissed">Reddedilen</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Tür</TableHead>
                              <TableHead className="text-xs">Sebep</TableHead>
                              <TableHead className="text-xs">Durum</TableHead>
                              <TableHead className="text-xs hidden sm:table-cell">Bildiren</TableHead>
                              <TableHead className="text-xs hidden md:table-cell">Tarih</TableHead>
                              <TableHead className="text-xs text-right">İşlem</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(filteredReports, reportPage).map((r: any) => (
                              <TableRow key={r.id}>
                                <TableCell><Badge variant="outline" className="text-[10px]">{r.target_type}</Badge></TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">{r.reason}</TableCell>
                                <TableCell><StatusBadge status={r.status} /></TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{getUsername(r.reporter_id)}</TableCell>
                                <TableCell className="text-[11px] text-muted-foreground hidden md:table-cell">
                                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: tr })}
                                </TableCell>
                                <TableCell className="text-right">
                                  {r.status === "pending" ? (
                                    <ReportActionDialog
                                      report={r}
                                      onResolve={(note) => handleUpdateReport(r.id, "resolved", note)}
                                      onDismiss={(note) => handleUpdateReport(r.id, "dismissed", note)}
                                      onDeleteContent={(note) => handleDeleteReportedContent(r, note)}
                                      onMarkAbuse={(note) => handleMarkReportAbuse(r, note)}
                                      onWarnUser={(note) => handleWarnReportedUser(r, note)}
                                      onMuteUser={(note) => handleMuteReportedUser(r, note)}
                                      onSuspendUser={(note) => handleSuspendReportedUser(r, note)}
                                      onRemoveAvatar={(note) => handleRemoveAvatar(r, note)}
                                    />
                                  ) : (
                                    r.admin_note && <span className="text-[10px] text-muted-foreground max-w-[100px] truncate block">{r.admin_note}</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                            {filteredReports.length === 0 && (
                              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Rapor bulunamadı.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={reportPage} setPage={setReportPage} total={filteredReports.length} />
                    </Card>
                  </div>
                )}

                {/* ═══ SECURITY ═══ */}
                {activeTab === "security" && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1">
                        <SearchBar value={securitySearch} onChange={(v) => { setSecuritySearch(v); setSecurityPage(0); }} placeholder="Güvenlik logu ara (olay, kullanıcı)..." />
                      </div>
                      <Select value={securityLogFilter} onValueChange={(v) => { setSecurityLogFilter(v); setSecurityPage(0); }}>
                        <SelectTrigger className="w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {securityEventTypes.map((t) => (
                            <SelectItem key={t} value={t}>{t === "all" ? "Tüm olaylar" : t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Card className="overflow-hidden">
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Tarih</TableHead>
                              <TableHead className="text-xs">Olay</TableHead>
                              <TableHead className="text-xs">Kullanıcı</TableHead>
                              <TableHead className="text-xs">Detay</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginate(filteredSecurityLogs, securityPage).map((log: any) => {
                              const meta = log.metadata || {};
                              return (
                                <TableRow key={log.id}>
                                  <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: tr })}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={["login_failure", "suspicious_activity", "brute_force"].includes(log.event_type) ? "destructive" : log.event_type === "login_success" ? "default" : "outline"} className="text-[10px]">
                                      {log.event_type}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{getUsername(log.user_id) || meta.email || "—"}</TableCell>
                                  <TableCell className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                                    {meta.device ? `${meta.device.browser}/${meta.device.os}` : ""}
                                    {meta.reason ? ` — ${meta.reason}` : ""}
                                    {meta.method ? ` (${meta.method})` : ""}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {filteredSecurityLogs.length === 0 && (
                              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Güvenlik logu bulunamadı.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                      <PaginationControls page={securityPage} setPage={setSecurityPage} total={filteredSecurityLogs.length} />
                    </Card>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

/* ═══ Report Action Dialog ═══ */
function ReportActionDialog({ report, onResolve, onDismiss, onDeleteContent, onMarkAbuse, onWarnUser, onMuteUser, onSuspendUser, onRemoveAvatar }: {
  report: any;
  onResolve: (note: string) => void;
  onDismiss: (note: string) => void;
  onDeleteContent: (note: string) => void;
  onMarkAbuse: (note: string) => void;
  onWarnUser: (note: string) => void;
  onMuteUser: (note: string) => void;
  onSuspendUser: (note: string) => void;
  onRemoveAvatar: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const act = (fn: (n: string) => void) => { fn(note); setOpen(false); setNote(""); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-[10px] px-2">İşlem Yap</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="text-sm font-bold">Rapor İşlemi</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Moderasyon Notu</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Neden bu işlemi yaptığınızı yazın..." rows={2} maxLength={500} className="text-sm" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Rapor İşlemleri</p>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" className="w-full gap-1.5 text-xs" onClick={() => act(onResolve)}><CheckCircle className="h-3.5 w-3.5" /> Çözüldü</Button>
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => act(onDismiss)}><XCircle className="h-3.5 w-3.5" /> Reddet</Button>
              <Button size="sm" variant="secondary" className="w-full gap-1.5 text-xs" onClick={() => act(onMarkAbuse)}><AlertTriangle className="h-3.5 w-3.5" /> Asılsız (Bildireni Uyar)</Button>
            </div>
          </div>
          <div className="space-y-1 border-t pt-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">İçerik İşlemleri</p>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="destructive" className="w-full gap-1.5 text-xs" onClick={() => act(onDeleteContent)}><Trash2 className="h-3.5 w-3.5" /> İçeriği Sil</Button>
              {(report.target_type === "user" || report.target_type === "avatar") && (
                <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs border-destructive text-destructive" onClick={() => act(onRemoveAvatar)}><UserX className="h-3.5 w-3.5" /> Avatarı Kaldır</Button>
              )}
            </div>
          </div>
          <div className="space-y-1 border-t pt-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Kullanıcı İşlemleri</p>
            <div className="flex flex-col gap-1.5">
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs" onClick={() => act(onWarnUser)}><CircleAlert className="h-3.5 w-3.5" /> Uyar</Button>
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs text-amber-600 border-amber-300" onClick={() => act(onMuteUser)}><VolumeX className="h-3.5 w-3.5" /> Sustur (6 saat)</Button>
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs text-destructive border-destructive" onClick={() => act(onSuspendUser)}><Ban className="h-3.5 w-3.5" /> Askıya Al (7 gün)</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══ User Detail Dialog ═══ */
function UserDetailDialog({ user: u, role, postCount, commentCount, onDeleted }: { user: any; role: string; postCount: number; commentCount: number; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteUser = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("admin-delete-user", { body: { target_user_id: u.user_id } });
      if (error) { toast.error("Silinemedi: " + error.message); }
      else { toast.success("Kullanıcı silindi."); setOpen(false); setConfirmDelete(false); onDeleted?.(); }
    } catch (err: any) { toast.error("Hata: " + (err.message || "Bilinmeyen")); }
    finally { setDeleting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmDelete(false); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.username} />}
              <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{(u.username || "?")[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            {u.username || "Anonim"}
            {u.display_name && u.display_name !== u.username && <span className="text-muted-foreground font-normal text-xs">({u.display_name})</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase">Üniversite</p>
              <p className="font-medium">{u.university || "—"}</p>
              {u.university && <p className="text-[10px] text-muted-foreground">{getUniversityMetaLabel(u.university)}</p>}
            </div>
            <div><p className="text-[10px] text-muted-foreground font-semibold uppercase">Bölüm</p><p className="font-medium">{u.department || "—"}</p></div>
            <div><p className="text-[10px] text-muted-foreground font-semibold uppercase">Sınıf</p><p className="font-medium">{u.class_year != null ? (u.class_year === 0 ? "Hazırlık" : `${u.class_year}. Sınıf`) : "—"}</p></div>
            <div><p className="text-[10px] text-muted-foreground font-semibold uppercase">Rol</p><Badge variant={role === "admin" ? "destructive" : "outline"} className="text-[10px]">{role}</Badge></div>
            <div><p className="text-[10px] text-muted-foreground font-semibold uppercase">Mod Skoru</p><p className="font-medium">{u.moderation_score || 0}</p></div>
            <div><p className="text-[10px] text-muted-foreground font-semibold uppercase">Durum</p><UserStatusBadges user={u} /></div>
          </div>
          {u.bio && <div><p className="text-[10px] text-muted-foreground font-semibold uppercase">Hakkında</p><p className="text-sm text-muted-foreground">{u.bio}</p></div>}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            <div className="text-center"><p className="text-lg font-extrabold">{u.reputation_points ?? 0}</p><p className="text-[10px] text-muted-foreground"><Star className="h-2.5 w-2.5 inline mr-0.5" />Puan</p></div>
            <div className="text-center"><p className="text-lg font-extrabold">{postCount}</p><p className="text-[10px] text-muted-foreground"><FileText className="h-2.5 w-2.5 inline mr-0.5" />Gönderi</p></div>
            <div className="text-center"><p className="text-lg font-extrabold">{commentCount}</p><p className="text-[10px] text-muted-foreground"><MessageSquare className="h-2.5 w-2.5 inline mr-0.5" />Yorum</p></div>
          </div>
          <div className="text-[11px] text-muted-foreground">Kayıt: {formatDistanceToNow(new Date(u.created_at), { addSuffix: true, locale: tr })}</div>
          <Button variant="outline" size="sm" className="w-full text-xs" asChild><Link to={`/user/${u.user_id}`}>Profili Görüntüle</Link></Button>
          {role !== "admin" && (
            <div className="border-t pt-3">
              {!confirmDelete ? (
                <Button variant="destructive" size="sm" className="w-full text-xs gap-1.5" onClick={() => setConfirmDelete(true)}><UserX className="h-3.5 w-3.5" /> Kullanıcıyı Sil</Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-destructive font-medium text-center">Bu işlem geri alınamaz!</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setConfirmDelete(false)} disabled={deleting}>İptal</Button>
                    <Button variant="destructive" size="sm" className="flex-1 text-xs" onClick={handleDeleteUser} disabled={deleting}>{deleting ? "Siliniyor..." : "Onayla"}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══ Course Form Dialog ═══ */
function CourseFormDialog({
  course,
  universities,
  courses,
  departmentsCatalog,
  onSaved,
}: {
  course?: any;
  universities: string[];
  courses: any[];
  departmentsCatalog: any[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(course?.name || "");
  const [code, setCode] = useState(course?.code || "");
  const [description, setDescription] = useState(course?.description || "");
  const [university, setUniversity] = useState(course?.university || "Ege Üniversitesi");
  const [department, setDepartment] = useState(course?.department || "");
  const [year, setYear] = useState<number>(course?.year || 1);
  const [customUni, setCustomUni] = useState("");
  const [customDept, setCustomDept] = useState("");

  const selectedUniversity = customUni.trim() || university;
  const allUnis = [...new Set(universities.filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
  const departmentsForUniversity = useMemo(() => {
    if (!selectedUniversity) return [];
    const dbDepts = departmentsCatalog
      .filter((d: any) => d.university === selectedUniversity && d.name)
      .map((d: any) => d.name);
    const existingDepts = courses.filter((c: any) => c.university === selectedUniversity && c.department).map((c: any) => c.department);
    const merged = [...new Set([...dbDepts, ...existingDepts])];
    return merged.sort((a, b) => a.localeCompare(b, "tr"));
  }, [selectedUniversity, courses, departmentsCatalog]);

  useEffect(() => {
    if (!department && departmentsForUniversity.length > 0) { setDepartment(departmentsForUniversity[0]); return; }
    if (department && !departmentsForUniversity.includes(department) && departmentsForUniversity.length > 0) setDepartment(departmentsForUniversity[0]);
  }, [department, departmentsForUniversity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const finalUni = selectedUniversity;
    const finalDept = customDept.trim() || department;
    if (!finalUni) { toast.error("Üniversite seçin"); return; }
    if (!finalDept) { toast.error("Bölüm seçin"); return; }
    setLoading(true);
    const payload = { name: name.trim(), code: code.trim() || null, description: description.trim() || null, university: finalUni, department: finalDept, year };
    let error;
    if (course) ({ error } = await supabase.from("courses").update(payload).eq("id", course.id));
    else ({ error } = await supabase.from("courses").insert(payload));
    if (error) toast.error(error.message);
    else { toast.success(course ? "Güncellendi" : "Eklendi"); setOpen(false); if (!course) { setName(""); setCode(""); setDescription(""); setCustomUni(""); setCustomDept(""); } onSaved(); }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {course ? <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
          : <Button size="sm" className="gap-1.5 h-9 text-xs"><Plus className="h-4 w-4" /> Ders Ekle</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="font-heading">{course ? "Ders Düzenle" : "Yeni Ders"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Üniversite</Label>
              <Select value={university} onValueChange={setUniversity}>
                <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{allUnis.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Veya yeni üniversite..." value={customUni} onChange={(e) => setCustomUni(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Bölüm</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Bölüm seçin" /></SelectTrigger>
                <SelectContent>{departmentsForUniversity.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="Veya yeni bölüm..." value={customDept} onChange={(e) => setCustomDept(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sınıf</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{[0, 1, 2, 3, 4, 5, 6].map((y) => <SelectItem key={y} value={String(y)}>{y === 0 ? "Hazırlık" : `${y}. Sınıf`}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ders Kodu</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EEM101" maxLength={20} className="h-9 text-xs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ders Adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fizik I" required maxLength={100} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Açıklama</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ders açıklaması..." rows={2} maxLength={500} className="text-xs" />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !name.trim()}>{loading ? "Kaydediliyor..." : course ? "Güncelle" : "Ekle"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ═══ Support Ticket Card ═══ */
function SupportTicketCard({ ticket, getUsername, onReply, onClose }: { ticket: any; getUsername: (id: string) => string; onReply: (id: string, reply: string) => void; onClose: (id: string) => void }) {
  const [reply, setReply] = useState("");
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">{ticket.subject}</p>
          <p className="text-[10px] text-muted-foreground">{getUsername(ticket.user_id)} · {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: tr })}</p>
        </div>
        <Badge variant="destructive" className="text-[10px]">Açık</Badge>
      </div>
      <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg">{ticket.message}</p>
      <div className="space-y-2">
        <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Yanıtınızı yazın..." rows={2} className="text-sm" maxLength={2000} />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs" disabled={!reply.trim()} onClick={() => { onReply(ticket.id, reply); setReply(""); }}>Yanıtla</Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onClose(ticket.id)}>Kapat</Button>
        </div>
      </div>
    </Card>
  );
}

