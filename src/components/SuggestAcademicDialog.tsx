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
import { Plus, Loader2, CheckCircle, XCircle, Clock, BookOpen } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { buildYearOptions, fetchAcademicProgramsForUniversity, type AcademicProgramRow } from "@/lib/academic-catalog";
import { normalizeCourseCode, normalizeCourseCodeOrNull } from "@/lib/course-code";

type SuggestionType = "course";

interface SuggestAcademicDialogProps {
  type?: SuggestionType;
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

export default function SuggestAcademicDialog({
  type = "course",
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
  const [department, setDepartment] = useState(defaultDepartment);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [classYear, setClassYear] = useState("");
  const [explanation, setExplanation] = useState("");

  const [programRows, setProgramRows] = useState<AcademicProgramRow[]>([]);

  useEffect(() => {
    if (!open || !university) {
      setProgramRows([]);
      return;
    }

    let cancelled = false;

    const fetchPrograms = async () => {
      try {
        const rows = await fetchAcademicProgramsForUniversity(university);
        if (!cancelled) setProgramRows(rows);
      } catch {
        if (!cancelled) setProgramRows([]);
      }
    };

    void fetchPrograms();

    return () => {
      cancelled = true;
    };
  }, [open, university]);

  const departmentOptions = programRows.map((row) => ({
    label: row.program_name,
    sublabel: row.unit_name || (row.program_level === "onlisans" ? "Önlisans" : "Lisans"),
  }));

  const selectedProgram = programRows.find((row) => row.program_name === department) || null;
  const maxClassYear = selectedProgram?.program_years || 4;
  const classYearOptions = buildYearOptions(maxClassYear);

  useEffect(() => {
    if (!classYear) return;
    const year = Number.parseInt(classYear, 10);
    if (Number.isFinite(year) && year > maxClassYear) {
      setClassYear("");
    }
  }, [classYear, maxClassYear]);

  const resetForm = () => {
    setStatus("idle");
    setStatusMessage("");
    if (!defaultUniversity) setUniversity("");
    if (!defaultDepartment) setDepartment("");
    setCourseName("");
    setCourseCode("");
    setClassYear("");
    setExplanation("");
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (type !== "course") {
      setStatus("error");
      setStatusMessage("Bu dialog artık sadece ders önerileri için kullanılabilir.");
      return;
    }

    if (!university.trim()) {
      toast.error("Üniversite seçimi zorunludur.");
      return;
    }
    if (!department.trim()) {
      toast.error("Bölüm seçimi zorunludur.");
      return;
    }
    if (!courseName.trim()) {
      toast.error("Ders adı zorunludur.");
      return;
    }
    if (!classYear) {
      toast.error("Sınıf seçimi zorunludur.");
      return;
    }

    setStatus("validating");
    setStatusMessage("Ders doğrulanıyor...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
      setStatusMessage("AI doğrulama ve müfredat kontrolü yapılıyor...");

      const { data, error } = await supabase.functions.invoke("validate-academic", {
        body: {
          type: "course",
          university: university.trim(),
          department: department.trim(),
          course_name: courseName.trim(),
          course_code: normalizeCourseCodeOrNull(courseCode),
          class_year: classYear || null,
          explanation: explanation.trim() || null,
        },
      });

      if (error) throw error;

      const result = data as any;

      if (result.status === "approved") {
        setStatus("approved");
        setStatusMessage(result.reason || "Ders doğrulandı ve eklendi.");
        toast.success("Ders doğrulandı ve eklendi.");
        onApproved?.({ normalized_name: result.normalized_name, course_id: result.course_id, department_id: result.department_id });
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 1200);
        return;
      }

      if (result.status === "pending_review") {
        setStatus("pending_review");
        setStatusMessage(result.reason || "Ders önerisi admin incelemesine alındı.");
        toast.info(result.reason || "Ders önerisi admin incelemesine alındı.");
        return;
      }

      if (result.status === "duplicate") {
        setStatus("duplicate");
        setStatusMessage(result.reason || "Bu ders zaten mevcut.");
        toast.warning(result.reason || "Bu ders zaten mevcut.");
        return;
      }

      if (result.status === "rejected") {
        setStatus("rejected");
        setStatusMessage(result.reason || "Bu ders doğrulanamadı.");
        return;
      }

      setStatus("error");
      setStatusMessage(result.reason || result.error || "Bilinmeyen bir hata oluştu.");
    } catch (err: any) {
      console.error("Course validation error:", err);
      setStatus("error");
      setStatusMessage(err?.message || "Doğrulama sırasında bir hata oluştu.");
    }
  };

  if (!user) return null;

  const StatusIcon = STATUS_CONFIG[status].icon;
  const statusColor = STATUS_CONFIG[status].color;

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) resetForm(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Ders Öner
            </Button>
          )}
        </DialogTrigger>
      )}

      {isControlled && trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Eksik Ders Öner
          </DialogTitle>
          <DialogDescription className="text-xs">
            Bu akış AI destekli ders doğrulaması için korunur. Bölüm/program talepleri ayrı request kuyruğuna gider.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!defaultUniversity && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Üniversite</Label>
              <Input
                value={university}
                onChange={(e) => {
                  setUniversity(e.target.value);
                  setDepartment("");
                  setClassYear("");
                }}
                placeholder="Üniversite adı"
                className="h-9 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Bölüm</Label>
            <SearchableSelect
              value={department}
              onValueChange={(value) => {
                setDepartment(value);
                setClassYear("");
              }}
              placeholder={university ? "Bölüm seçin" : "Önce üniversite seçin"}
              searchPlaceholder="Bölüm ara..."
              options={departmentOptions}
              disabled={!university}
              allowCustom
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Ders Adı</Label>
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
              <Label className="text-xs font-semibold">Ders Kodu (opsiyonel)</Label>
              <Input
                value={courseCode}
                onChange={(e) => setCourseCode(normalizeCourseCode(e.target.value))}
                placeholder="Örn: BIL301"
                maxLength={20}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Sınıf</Label>
              <Select value={classYear} onValueChange={setClassYear}>
                <SelectTrigger
                  className="h-9 rounded-lg border-border/70 bg-background text-sm hover:border-primary/30"
                  disabled={!department}
                >
                  <SelectValue placeholder={department ? `0-${maxClassYear} arası seçin` : "Önce bölüm seçin"} />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border/70 p-1">
                  {classYearOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="rounded-md py-2 text-sm">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Açıklama (opsiyonel)</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Ek bilgi"
              rows={2}
              maxLength={500}
              className="text-sm"
            />
          </div>

          {status !== "idle" && (
            <div className={`flex items-start gap-2.5 p-3 rounded-lg bg-secondary/50 border ${statusColor}`}>
              <StatusIcon className={`h-4 w-4 mt-0.5 shrink-0 ${status === "validating" ? "animate-spin" : ""}`} />
              <div className="text-sm">
                <p className="font-medium">{STATUS_CONFIG[status].label}</p>
                {statusMessage && <p className="text-xs text-muted-foreground mt-0.5">{statusMessage}</p>}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {status === "idle" || status === "rejected" || status === "duplicate" || status === "error" ? (
              <Button
                onClick={handleSubmit}
                className="flex-1 h-9"
                disabled={!university.trim() || !department.trim() || !courseName.trim() || !classYear}
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
