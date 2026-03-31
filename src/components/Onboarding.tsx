import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Building2, BookOpen, ArrowRight, Check, Search, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import SearchableSelect from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { getDepartmentsForUniversity, ONLISANS_PROGRAMS } from "@/data/turkish-universities";

const ALL_YEARS = ["Hazırlık", "1. Sınıf", "2. Sınıf", "3. Sınıf", "4. Sınıf", "5. Sınıf", "6. Sınıf"];

type ValidationStatus = "idle" | "validating" | "approved" | "pending_review" | "rejected" | "duplicate" | "error";

interface OnboardingProps {
  onComplete: (university: string, dept: string, year: string) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [year, setYear] = useState("");

  const [missingDeptOpen, setMissingDeptOpen] = useState(false);
  const [customDepartment, setCustomDepartment] = useState("");
  const [dbDepartments, setDbDepartments] = useState<string[]>([]);
  const [dbUniversities, setDbUniversities] = useState<{ name: string; city: string | null; type: string | null }[]>([]);

  // AI validation states
  const [deptValidation, setDeptValidation] = useState<ValidationStatus>("idle");
  const [deptValidationMsg, setDeptValidationMsg] = useState("");

  const steps = [
    { title: "Üniversiteni Seç", subtitle: "Hangi üniversitede okuyorsun?", icon: GraduationCap },
    { title: "Bölümünü Seç", subtitle: "Hangi bölümdesin?", icon: Building2 },
    { title: "Sınıfını Seç", subtitle: "Kaçıncı sınıftasın?", icon: BookOpen },
  ];

  // Fetch DB universities on mount
  useEffect(() => {
    supabase
      .from("universities" as any)
      .select("name, city, type, country")
      .in("country", ["TR", "KKTC"])
      .limit(1000)
      .then(({ data }) => {
        setDbUniversities((data || []).map((u: any) => ({
          name: u.name,
          city: u.city || null,
          type: u.type || null,
        })));
      });
  }, []);

  useEffect(() => {
    if (!university) { setDbDepartments([]); return; }
    supabase
      .from("departments")
      .select("name")
      .eq("university", university)
      .order("name", { ascending: true })
      .then(({ data }) => {
        setDbDepartments((data || []).map((d: any) => d.name).filter(Boolean));
      });
  }, [university]);

  const getAvailableYears = () => {
    if (!department) return ALL_YEARS;
    const isOnlisans = ONLISANS_PROGRAMS.includes(department);
    if (isOnlisans) return ["1. Sınıf", "2. Sınıf"];
    const sixYearDepts = ["Tıp"];
    if (sixYearDepts.includes(department)) return ALL_YEARS;
    const fiveYearDepts = ["Eczacılık", "Diş Hekimliği", "Veteriner Hekimliği", "Mimarlık"];
    if (fiveYearDepts.includes(department)) return ALL_YEARS.slice(0, 6); // Hazırlık + 5 sınıf
    return ["Hazırlık", "1. Sınıf", "2. Sınıf", "3. Sınıf", "4. Sınıf"];
  };

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
    else onComplete(university, department, year);
  };

  const canProceed = step === 0 ? !!university : step === 1 ? !!department : !!year;

  const universityOptions = (() => {
    return dbUniversities
      .map(u => ({
        label: u.name,
        sublabel: u.city
          ? `${u.city} · ${u.type === "devlet" ? "Devlet" : u.type === "vakıf" ? "Vakıf" : "Üniversite"}`
          : "Üniversite",
        group: "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  })();

  const departmentOptions = (() => {
    const staticDepts = getDepartmentsForUniversity(university);
    const allDepts = [...new Set([...staticDepts, ...dbDepartments])].sort((a, b) => a.localeCompare(b, "tr"));
    return allDepts.map((d) => ({ label: d }));
  })();

  const availableYears = getAvailableYears();
  const StepIcon = steps[step].icon;

  const handleUniversityChange = (val: string) => {
    setUniversity(val);
    setDepartment("");
    setYear("");
  };

  const handleDepartmentChange = (val: string) => {
    setDepartment(val);
    setYear("");
    setDeptValidation("idle");
    setDeptValidationMsg("");
  };

  // AI validation for department
  const validateDepartment = async () => {
    if (!customDepartment.trim() || !university) return;
    const applyDepartmentSelection = (name: string) => {
      const next = name.trim();
      if (!next) return;
      setDepartment(next);
      setYear("");
    };
    setDeptValidation("validating");
    setDeptValidationMsg("Bölüm doğrulanıyor...");

    try {
      const { data, error } = await supabase.functions.invoke("validate-academic", {
        body: { type: "department", university, department: customDepartment.trim() },
      });

      if (error) throw error;
      const result = data as any;

      if (result.status === "approved") {
        setDeptValidation("approved");
        setDeptValidationMsg(result.reason || "Bölüm doğrulandı!");
        applyDepartmentSelection(result.normalized_name || customDepartment.trim());
        setTimeout(() => {
          setMissingDeptOpen(false);
          setCustomDepartment("");
        }, 1500);
      } else if (result.status === "duplicate") {
        setDeptValidation("duplicate");
        setDeptValidationMsg(result.reason || "Bu bölüm zaten mevcut.");
        if (result.existing_name) {
          setTimeout(() => {
            applyDepartmentSelection(result.existing_name);
            setMissingDeptOpen(false);
            setCustomDepartment("");
            setDeptValidation("idle");
          }, 1200);
        }
      } else if (result.status === "pending_review") {
        setDeptValidation("pending_review");
        setDeptValidationMsg(result.reason || "Öneriniz admin incelemesine gönderildi. Onay sonrası kullanabilirsiniz.");
        applyDepartmentSelection(customDepartment.trim());
        setTimeout(() => {
          setMissingDeptOpen(false);
          setCustomDepartment("");
        }, 1200);
      } else {
        setDeptValidation("rejected");
        setDeptValidationMsg(result.reason || "Bu bölüm doğrulanamadı.");
      }
    } catch (err) {
      console.error("Dept validation error:", err);
      setDeptValidation("error");
      setDeptValidationMsg("Doğrulama servisi geçici olarak kullanılamıyor. Bölümünüz kaydedildi, admin incelemesine alınacaktır.");
      setDeptValidationMsg("Bölüm doğrulama servisine ulaşılamadı. Lütfen tekrar deneyin.");
    }
  };

  const ValidationFeedback = ({ status, message }: { status: ValidationStatus; message: string }) => {
    if (status === "idle") return null;
    const config: Record<ValidationStatus, { icon: any; color: string; bg: string }> = {
      idle: { icon: null, color: "", bg: "" },
      validating: { icon: Loader2, color: "text-primary", bg: "bg-primary/5 border-primary/20" },
      approved: { icon: CheckCircle, color: "text-success", bg: "bg-success/10 border-success/20" },
      pending_review: { icon: Clock, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
      rejected: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
      duplicate: { icon: CheckCircle, color: "text-warning", bg: "bg-warning/10 border-warning/20" },
      error: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/5 border-destructive/20" },
    };
    const { icon: Icon, color, bg } = config[status];
    if (!Icon) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-2 p-3 rounded-lg border text-left ${bg}`}
      >
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color} ${status === "validating" ? "animate-spin" : ""}`} />
        <p className={`text-xs ${color}`}>{message}</p>
      </motion.div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 overflow-hidden" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <div className="h-1 bg-secondary">
            <motion.div
              className="h-full gradient-hero"
              initial={{ width: "0%" }}
              animate={{ width: `${((step + 1) / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="p-8 text-center">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl gradient-hero mb-5">
                <StepIcon className="h-7 w-7 text-primary-foreground" />
              </div>

              <h2 className="font-heading text-xl font-extrabold mb-1">{steps[step].title}</h2>
              <p className="text-sm text-muted-foreground mb-6">{steps[step].subtitle}</p>

              <div className="mb-6">
                {step === 0 && (
                  <div className="space-y-3">
                    <SearchableSelect
                      value={university}
                      onValueChange={handleUniversityChange}
                      placeholder="Üniversite seçin"
                      searchPlaceholder="Üniversite veya şehir ara..."
                      options={universityOptions}
                    />
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-3">
                    <SearchableSelect
                      value={department}
                      onValueChange={handleDepartmentChange}
                      placeholder="Bölüm seçin"
                      searchPlaceholder="Bölüm ara..."
                      options={departmentOptions}
                    />

                    <button
                      type="button"
                      onClick={() => { setMissingDeptOpen(true); setDeptValidation("idle"); setDeptValidationMsg(""); }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary text-sm font-semibold hover:bg-primary/10 hover:border-primary/50 transition-all"
                    >
                      <Search className="h-4 w-4" />
                      Bölümümü Bulamadım
                    </button>

                    {missingDeptOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-secondary/50 border text-left space-y-3"
                      >
                        <Label className="text-xs font-semibold">Bölüm adını girin</Label>
                        <Input
                          value={customDepartment}
                          onChange={(e) => { setCustomDepartment(e.target.value); setDeptValidation("idle"); }}
                          placeholder="Örn: Bilgisayar Mühendisliği"
                          className="h-9 text-sm"
                          maxLength={200}
                          autoFocus
                          disabled={deptValidation === "validating"}
                        />

                        <ValidationFeedback status={deptValidation} message={deptValidationMsg} />

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs flex-1"
                            onClick={() => { setMissingDeptOpen(false); setCustomDepartment(""); setDeptValidation("idle"); }}
                            disabled={deptValidation === "validating"}
                          >
                            İptal
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs flex-1"
                            disabled={!customDepartment.trim() || deptValidation === "validating" || deptValidation === "approved"}
                            onClick={validateDepartment}
                          >
                            {deptValidation === "validating" ? (
                              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Doğrulanıyor</>
                            ) : (
                              "Doğrula ve Kullan"
                            )}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Yapay zeka ile doğrulanacak. Onay sonrası devam edebilirsiniz.
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-2">
                    {availableYears.map((option) => (
                      <button
                        key={option}
                        onClick={() => setYear(option)}
                        className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium flex items-center justify-between ${
                          year === option
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border hover:border-primary/30 text-foreground"
                        }`}
                      >
                        {option}
                        {year === option && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                {step > 0 && (
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep(step - 1)}>
                    Geri
                  </Button>
                )}
                <Button
                  className="flex-1 h-11 rounded-xl font-semibold gap-2"
                  onClick={handleNext}
                  disabled={!canProceed}
                >
                  {step === 2 ? "Başla" : "Devam Et"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 mt-5">
                {[0, 1, 2].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s === step ? "w-6 bg-primary" : s < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-border"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
