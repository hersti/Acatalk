import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Loader2, CheckCircle, XCircle, Clock, GraduationCap, BookOpen } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { getSortedUniversities, getDepartmentsForUniversity, ONLISANS_PROGRAMS } from "@/data/turkish-universities";
import { normalizeCourseCode, normalizeCourseCodeOrNull } from "@/lib/course-code";

type SuggestionType = "department" | "course";

interface SuggestAcademicDialogProps {
  type: SuggestionType;
  university?: string;
  department?: string;
  onApproved?: (data: { normalized_name: string; course_id?: string; department_id?: string }) => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type ValidationStatus = "idle" | "validating" | "approved" | "pending_review" | "rejected" | "duplicate" | "error";

const STATUS_CONFIG: Record<ValidationStatus, { icon: typeof Loader2; label: string; color: string }> = {
  idle: { icon: Plus, label: "", color: "" },
  validating: { icon: Loader2, label: "Doğrulanıyor...", color: "text-primary" },
  approved: { icon: CheckCircle, label: "Onaylandı!", color: "text-success" },
  pending_review: { icon: Clock, label: "Admin incelemesine gönderildi", color: "text-warning" },
  rejected: { icon: XCircle, label: "Doğrulanamadı", color: "text-destructive" },
  duplicate: { icon: XCircle, label: "Bu zaten mevcut", color: "text-warning" },
  error: { icon: XCircle, label: "Bir hata oluştu", color: "text-destructive" },
};

type DepartmentOption = {
  name: string;
  program_years: number | null;
};

const normalizeDepartmentName = (value: string) => value.toLocaleLowerCase("tr-TR").trim();

const inferProgramYearsFromDepartment = (departmentName: string): number => {
  const normalized = normalizeDepartmentName(departmentName);

  if (normalized.includes("tıp")) return 6;
  if (["eczac", "diş", "veteriner", "mimarlık"].some((keyword) => normalized.includes(keyword))) return 5;
  if (
    normalized.includes("önlisans") ||
    normalized.includes("meslek yüksekokulu") ||
    normalized.includes("myo") ||
    ONLISANS_PROGRAMS.some((program) => normalizeDepartmentName(program) === normalized)
  ) {
    return 2;
  }

  return 4;
};

const sanitizeProgramYears = (value: number | null | undefined, fallbackDepartment: string): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(6, Math.max(2, Math.trunc(value)));
  }

  return inferProgramYearsFromDepartment(fallbackDepartment);
};

export default function SuggestAcademicDialog({
  type,
  university: defaultUniversity = "",
  department: defaultDepartment = "",
  onApproved,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SuggestAcademicDialogProps) {
  const { user } = useAuth();

  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) controlledOnOpenChange?.(v);
    else setInternalOpen(v);
  };

  const [status, setStatus] = useState<ValidationStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const [university, setUniversity] = useState(defaultUniversity);
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState(type === "course" ? defaultDepartment : "");
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [classYear, setClassYear] = useState("");
  const [explanation, setExplanation] = useState("");

  const universityOptions = getSortedUniversities().map((u) => ({
    label: u.name,
    sublabel: `${u.city} · ${u.type === "devlet" ? "Devlet" : "Vakıf"}`,
    group: u.popular ? "⭐ Popüler" : "",
  }));

  const [dbDepartments, setDbDepartments] = useState<DepartmentOption[]>([]);

  useEffect(() => {
    if (!open || !university || type !== "course") return;

    let isCancelled = false;

    const fetchDbDepts = async () => {
      const { data, error } = await supabase
        .from("departments" as any)
        .select("name, program_years")
        .eq("university", university)
        .order("name", { ascending: true });

      if (isCancelled) return;
      if (error || !data) {
        setDbDepartments([]);
        return;
      }

      const mapped = (data as any[])
        .map((item) => ({ name: String(item.name || "").trim(), program_years: item.program_years ?? null }))
        .filter((item) => item.name);

      setDbDepartments(mapped);
    };

    fetchDbDepts();

    return () => {
      isCancelled = true;
    };
  }, [university, type, open]);

  const staticDepts = getDepartmentsForUniversity(university);
  const dbDepartmentNames = dbDepartments.map((d) => d.name);
  const allDepts = [...new Set([...staticDepts, ...dbDepartmentNames])].sort((a, b) => a.localeCompare(b, "tr"));
  const departmentOptions = allDepts.map((d) => ({ label: d }));

  const selectedDepartmentRecord = dbDepartments.find(
    (item) => normalizeDepartmentName(item.name) === normalizeDepartmentName(department)
  );
  const maxClassYear = sanitizeProgramYears(selectedDepartmentRecord?.program_years ?? null, department || "");
  const classYearOptions = [
    { value: "0", label: "Hazırlık" },
    ...Array.from({ length: maxClassYear }, (_, index) => ({ value: String(index + 1), label: `${index + 1}. Sınıf` })),
  ];

  useEffect(() => {
    if (type !== "course" || !classYear) return;
    const currentYear = Number.parseInt(classYear, 10);
    if (!Number.isNaN(currentYear) && currentYear > maxClassYear) {
      setClassYear("");
    }
  }, [type, classYear, maxClassYear]);

  const resetForm = () => {
    setStatus("idle");
    setStatusMessage("");
    setFaculty("");
    if (!defaultUniversity) setUniversity("");
    if (!defaultDepartment) setDepartment("");
    setCourseName("");
    setCourseCode("");
    setClassYear("");
    setExplanation("");
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validation
    if (!university.trim()) { toast.error("Üniversite seçimi zorunludur."); return; }
    if (type === "department" && !department.trim()) { toast.error("Bölüm adı zorunludur."); return; }
    if (type === "course" && !courseName.trim()) { toast.error("Ders adı zorunludur."); return; }
    if (type === "course" && !department.trim()) { toast.error("Bölüm seçimi zorunludur."); return; }
    if (type === "course" && !classYear) { toast.error("Sınıf seçimi zorunludur."); return; }

    setStatus("validating");
    setStatusMessage(type === "department" ? "Bölüm araştırılıyor..." : "Ders araştırılıyor...");

    try {
      await new Promise((r) => setTimeout(r, 400));
      setStatusMessage("İnternet üzerinden doğrulama yapılıyor... Bu işlem biraz sürebilir.");

      const { data, error } = await supabase.functions.invoke("validate-academic", {
        body: {
          type,
          university: university.trim(),
          faculty: faculty.trim() || null,
          department: type === "department" ? department.trim() : department.trim(),
          course_name: type === "course" ? courseName.trim() : null,
          course_code: type === "course" ? normalizeCourseCodeOrNull(courseCode) : null,
          class_year: classYear || null,
          explanation: explanation.trim() || null,
        },
      });

      if (error) throw error;

      const result = data as any;

      if (result.status === "approved") {
        setStatus("approved");
        setStatusMessage(result.reason || "Onaylandı ve eklendi!");
        toast.success(type === "department" ? "Bölüm doğrulandı!" : "Ders doğrulandı ve eklendi!");
        onApproved?.({ normalized_name: result.normalized_name, course_id: result.course_id, department_id: result.department_id });
        setTimeout(() => { setOpen(false); resetForm(); }, 2000);
      } else if (result.status === "pending_review") {
        setStatus("pending_review");
        setStatusMessage(result.reason || "Öneriniz admin incelemesine gönderildi.");
        toast.info("Öneriniz inceleme kuyruğuna eklendi.");
      } else if (result.status === "duplicate") {
        setStatus("duplicate");
        setStatusMessage(result.reason || "Bu kayıt zaten mevcut.");
        toast.warning(result.reason || "Bu kayıt zaten mevcut.");
      } else if (result.status === "rejected") {
        setStatus("rejected");
        setStatusMessage(result.reason || "Bu öneri doğrulanamadı.");
        if (result.suggestion) {
          setStatusMessage((prev) => prev + ` Öneri: ${result.suggestion}`);
        }
      } else {
        setStatus("error");
        setStatusMessage(result.reason || result.error || "Bilinmeyen bir hata oluştu.");
      }
    } catch (err: any) {
      console.error("Validation error:", err);
      setStatus("error");
      setStatusMessage("Doğrulama sırasında bir hata oluştu. Lütfen tekrar deneyin.");
    }
  };

  if (!user) return null;

  const StatusIcon = STATUS_CONFIG[status].icon;
  const statusColor = STATUS_CONFIG[status].color;
  const isDepartment = type === "department";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              {isDepartment ? "Bölüm Öner" : "Ders Öner"}
            </Button>
          )}
        </DialogTrigger>
      )}
      {isControlled && trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            {isDepartment ? <GraduationCap className="h-5 w-5 text-primary" /> : <BookOpen className="h-5 w-5 text-primary" />}
            {isDepartment ? "Eksik Bölüm Öner" : "Eksik Ders Öner"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isDepartment
              ? "Listede olmayan bir bölümü önerebilirsiniz. Sistem otomatik olarak doğrulayacaktır."
              : "Listede olmayan bir dersi önerebilirsiniz. Doğrulama sonrası otomatik olarak eklenecektir."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* University */}
          {!defaultUniversity && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Üniversite <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={university}
                onValueChange={(v) => { setUniversity(v); setDepartment(""); setClassYear(""); }}
                placeholder="Üniversite seçin"
                searchPlaceholder="Üniversite ara..."
                options={universityOptions}
              />
            </div>
          )}

          {/* Faculty (optional) */}
          {isDepartment && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fakülte (isteğe bağlı)</Label>
              <Input
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                placeholder="Örn: Mühendislik Fakültesi"
                maxLength={200}
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* Department name (for department type) */}
          {isDepartment && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Bölüm Adı <span className="text-destructive">*</span></Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Örn: Bilgisayar Mühendisliği"
                maxLength={200}
                className="h-9 text-sm"
              />
            </div>
          )}

          {/* Department select (for course type) */}
          {!isDepartment && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Bölüm <span className="text-destructive">*</span></Label>
              <SearchableSelect
                value={department}
                onValueChange={(value) => { setDepartment(value); setClassYear(""); }}
                placeholder="Bölüm seçin"
                searchPlaceholder="Bölüm ara..."
                options={departmentOptions}
                allowCustom
                disabled={!university}
              />
            </div>
          )}

          {/* Course fields */}
          {!isDepartment && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ders Adı <span className="text-destructive">*</span></Label>
                <Input
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="Örn: Veri Yapıları ve Algoritmalar"
                  maxLength={200}
                  className="h-9 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ders Kodu (isteğe bağlı)</Label>
                  <Input
                    value={courseCode}
                    onChange={(e) => setCourseCode(normalizeCourseCode(e.target.value))}
                    placeholder="Örn: BIL301"
                    maxLength={20}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sınıf <span className="text-destructive">*</span></Label>
                  <Select value={classYear} onValueChange={setClassYear}>
                    <SelectTrigger className="h-9 text-sm" disabled={!department}>
                      <SelectValue placeholder={department ? `0-${maxClassYear} arası seçin` : "Önce bölüm seçin"} />
                    </SelectTrigger>
                    <SelectContent>
                      {classYearOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Explanation */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Açıklama (isteğe bağlı)</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ek bilgi veya açıklama..."
              rows={2}
              maxLength={500}
              className="text-sm"
            />
          </div>

          {/* Status feedback */}
          {status !== "idle" && (
            <div className={`flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 border ${statusColor}`}>
              <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${status === "validating" ? "animate-spin" : ""}`} />
              <div className="text-sm">
                <p className="font-medium">{STATUS_CONFIG[status].label}</p>
                {statusMessage && <p className="text-xs text-muted-foreground mt-0.5">{statusMessage}</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {status === "idle" || status === "rejected" || status === "duplicate" || status === "error" ? (
              <Button
                onClick={handleSubmit}
                className="flex-1 h-9"
                disabled={
                  !university.trim() ||
                  (isDepartment && !department.trim()) ||
                  (!isDepartment && !courseName.trim()) ||
                  (!isDepartment && !department.trim()) ||
                  (!isDepartment && !classYear)
                }
              >
                Gönder ve Doğrula
              </Button>
            ) : status === "validating" ? (
              <Button disabled className="flex-1 h-9">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Doğrulanıyor...
              </Button>
            ) : (
              <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} className="flex-1 h-9">
                Kapat
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}