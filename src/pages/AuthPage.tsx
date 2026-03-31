import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isPasswordStrong } from "@/lib/password-validation";
import { logSecurityEvent, recordLoginAttempt, checkLoginLockout } from "@/lib/security-logger";
import { isNewDevice, markDeviceAsKnown, getDeviceInfo } from "@/lib/device-fingerprint";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import TurnstileWidget from "@/components/TurnstileWidget";
import SearchableSelect from "@/components/SearchableSelect";
import {
  getDepartmentsForUniversity,
  extractEmailDomain,
} from "@/data/turkish-universities";
import { sanitizeInput } from "@/lib/sanitize";
import { checkUsernameProfanity } from "@/lib/profanity-filter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GraduationCap, Lock, AlertTriangle, Mail, ShieldCheck, Info,
  Eye, EyeOff, CheckCircle2, XCircle, Loader2, User, KeyRound,
  FileText, Shield, Search, CheckCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";

type ValidationStatus = "idle" | "validating" | "approved" | "pending_review" | "rejected" | "duplicate" | "error";

/**
 * Determines program duration (in years) based on department name.
 * Turkish university system:
 * - 2 years: MYO / Ön Lisans programs
 * - 4 years: Standard (Engineering, Science, Arts, etc.)
 * - 5 years: Architecture, Pharmacy, Dentistry, Law, Veterinary
 * - 6 years: Medicine
 */
function getProgramYearsForDepartment(deptName: string): number {
  const lower = deptName.toLowerCase().replace(/İ/g, "i").replace(/I/g, "ı");
  
  // 6-year programs
  const sixYear = ["tıp", "tıp fakültesi", "genel tıp"];
  if (sixYear.some(k => lower.includes(k)) && !lower.includes("veteriner") && !lower.includes("diş")) return 6;
  
  // 5-year programs
  const fiveYear = [
    "eczacılık", "eczacı", "diş hekimliği", "dishekimliği",
    "mimarlık", "mimar", "veteriner",
  ];
  if (fiveYear.some(k => lower.includes(k))) return 5;
  
  // 2-year programs (MYO / Ön Lisans)
  const twoYear = [
    "meslek yüksekokulu", "myo", "ön lisans", "önlisans",
    "teknikerlik", "laborant", "odyometri", "anestezi",
    "ilk ve acil yardım", "tıbbi laboratuvar", "tıbbi görüntüleme",
    "tıbbi dokümantasyon", "radyoterapi", "diyaliz", "optisyenlik",
    "ağız ve diş sağlığı", "ameliyathane", "paramedik",
    "bilgisayar programcılığı", "web tasarım", "grafik tasarım",
    "muhasebe ve vergi", "bankacılık", "sigortacılık",
    "lojistik", "dış ticaret", "büro yönetimi",
    "çocuk gelişimi", "yaşlı bakım", "sivil havacılık",
    "aşçılık", "turizm ve otel", "pastacılık",
  ];
  if (twoYear.some(k => lower.includes(k))) return 2;
  
  return 4;
}

function ValidationFeedback({ status, message }: { status: ValidationStatus; message: string }) {
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
}

/* ─── MFA Sub-form ─── */
function MfaForm({
  loading, mfaCode, setMfaCode, newDeviceWarning, onSubmit, onBack,
}: {
  loading: boolean; mfaCode: string; setMfaCode: (v: string) => void;
  newDeviceWarning: boolean; onSubmit: (e: React.FormEvent) => void; onBack: () => void;
}) {
  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Card className="border-0 bg-card" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-xl gradient-hero flex items-center justify-center">
                <Lock className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="font-heading text-xl font-extrabold">İki Faktörlü Doğrulama</CardTitle>
            <CardDescription className="text-xs">Authenticator uygulamanızdaki 6 haneli kodu girin.</CardDescription>
          </CardHeader>
          <CardContent>
            {newDeviceWarning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 mb-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-[11px] text-warning-foreground">
                  Yeni bir cihazdan giriş yapıyorsunuz. Kimliğinizi doğrulayın.
                </p>
              </div>
            )}
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="h-12 rounded-lg text-center text-xl tracking-widest font-mono"
                autoFocus
                required
              />
              <Button type="submit" className="w-full h-10 rounded-lg font-semibold" disabled={loading || mfaCode.length !== 6}>
                {loading ? "Doğrulanıyor..." : "Doğrula"}
              </Button>
            </form>
            <div className="mt-3 text-center">
              <button onClick={onBack} className="text-xs text-muted-foreground hover:underline">Geri dön</button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* ─── Password Input with toggle ─── */
function PasswordInput({
  id, value, onChange, placeholder = "••••••••", required = true, className = "",
}: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={8}
        className={`h-10 rounded-lg pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ─── Username availability & profanity hook ─── */
function useUsernameCheck(username: string, isSignUp: boolean) {
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "inappropriate">("idle");

  useEffect(() => {
    if (!isSignUp || username.trim().length < 3) {
      setStatus("idle");
      return;
    }
    // Instant profanity check for usernames
    const profanityResult = checkUsernameProfanity(username.trim());
    if (!profanityResult.safe) {
      setStatus("inappropriate");
      return;
    }
    const timer = setTimeout(async () => {
      setStatus("checking");
      try {
        const { data } = await supabase.functions.invoke("check-username", {
          body: { username: username.trim().toLowerCase() },
        });
        switch (data?.status) {
          case "available":      setStatus("available");     break;
          case "taken":          setStatus("taken");          break;
          case "reserved":       setStatus("inappropriate");  break;
          case "invalid_format": setStatus("idle");           break;
          default:               setStatus("idle");           break;
        }
      } catch {
        setStatus("idle");
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, isSignUp]);

  return status;
}

/* ─── Main Component ─── */
export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // Legal modals
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Signup complete state
  const [signupComplete, setSignupComplete] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [university, setUniversity] = useState("");
  const [department, setDepartment] = useState("");
  const [classYear, setClassYear] = useState("");
  const [programYears, setProgramYears] = useState(4);
  const [bio, setBio] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Email domain detection
  const [detectedUniversity, setDetectedUniversity] = useState<string | null>(null);
  const [emailDomain, setEmailDomain] = useState("");
  const [emailError, setEmailError] = useState("");

  // Unknown domain request (admin-approved)
  const [requestedUniversityName, setRequestedUniversityName] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [requestResultMsg, setRequestResultMsg] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Custom department validation
  const [showCustomDept, setShowCustomDept] = useState(false);
  const [customDepartment, setCustomDepartment] = useState("");
  const [deptValidation, setDeptValidation] = useState<ValidationStatus>("idle");
  const [deptValidationMsg, setDeptValidationMsg] = useState("");

  // CAPTCHA
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // MFA
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [newDeviceWarning, setNewDeviceWarning] = useState(false);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});
  const usernameStatus = useUsernameCheck(username, isSignUp);

  const [dbDepartments, setDbDepartments] = useState<string[]>([]);

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

  const departmentOptions = (() => {
    const staticDepts = getDepartmentsForUniversity(university);
    const allDepts = [...new Set([...staticDepts, ...dbDepartments])].sort((a, b) =>
      a.localeCompare(b, "tr")
    );
    return allDepts.map((d) => ({ label: d }));
  })();

  // Auto-detect university from email via DB domain mapping (single source of truth)
  useEffect(() => {
    let cancelled = false;

    const buildDomainProbes = (fullDomain: string): string[] => {
      const probes: string[] = [];
      let probe = fullDomain.trim().toLowerCase();
      while (probe && probe.includes(".")) {
        probes.push(probe);
        const dot = probe.indexOf(".");
        if (dot === -1) break;
        probe = probe.substring(dot + 1);
      }
      return [...new Set(probes)];
    };

    const resolveUniversityFallback = async (fullDomain: string) => {
      const probes = buildDomainProbes(fullDomain);
      if (probes.length === 0) return null;

      const { data: domainRows, error: domainError } = await supabase
        .from("university_email_domains")
        .select("domain, university_id")
        .in("domain", probes);

      if (domainError || !domainRows || domainRows.length === 0) return null;

      const bestDomainMatch = [...domainRows]
        .sort((a: any, b: any) => String(b.domain || "").length - String(a.domain || "").length)[0];

      if (!bestDomainMatch?.university_id) return null;

      const { data: uniRow, error: uniError } = await supabase
        .from("universities")
        .select("id, name, country")
        .eq("id", bestDomainMatch.university_id)
        .in("country", ["TR", "KKTC"])
        .maybeSingle();

      if (uniError || !uniRow?.name) return null;

      return {
        found: true,
        university_name: uniRow.name,
      };
    };

    if (!isSignUp || !email.trim()) {
      setDetectedUniversity(null);
      setUniversity("");
      setEmailDomain("");
      setEmailError("");
      setRequestResultMsg("");
      setRequestSubmitted(false);
      setRequestedUniversityName("");
      setRequestNote("");
      return;
    }

    const domain = extractEmailDomain(email);
    setEmailDomain(domain);
    setRequestResultMsg("");
    setRequestSubmitted(false);

    if (!domain || !domain.includes(".")) {
      setDetectedUniversity(null);
      setUniversity("");
      setEmailError("");
      return;
    }

    if (!domain.endsWith(".edu.tr") && !domain.endsWith(".edu")) {
      setDetectedUniversity(null);
      setUniversity("");
      setEmailError("Sadece Türkiye ve KKTC üniversitelerine ait e-posta adresleriyle kayıt olabilirsiniz.");
      setRequestedUniversityName("");
      setRequestNote("");
      return;
    }

    const resolve = async () => {
      const { data, error } = await supabase.rpc("resolve_university_by_email_domain", {
        p_email: email.trim().toLowerCase(),
      } as any);

      if (cancelled) return;

      if (error) {
        const fallbackResolved = await resolveUniversityFallback(domain);
        if (cancelled) return;
        if (fallbackResolved?.found && fallbackResolved?.university_name) {
          setDetectedUniversity(fallbackResolved.university_name);
          setUniversity(fallbackResolved.university_name);
          setDepartment("");
          setEmailError("");
          setRequestedUniversityName("");
          setRequestNote("");
          return;
        }

        setDetectedUniversity(null);
        setUniversity("");
        setEmailError("Domain doğrulama servisi şu an yanıt vermiyor. Bu alan için talep oluşturabilirsiniz.");
        return;
      }

      const resolved = Array.isArray(data) ? data[0] : (data && typeof data === "object" ? data : null);
      if (resolved?.found && resolved?.university_name) {
        setDetectedUniversity(resolved.university_name);
        setUniversity(resolved.university_name);
        setDepartment("");
        setEmailError("");
        setRequestedUniversityName("");
        setRequestNote("");
        return;
      }

      setDetectedUniversity(null);
      setUniversity("");
      setDepartment("");
      setEmailError("Bu e-posta domaini sistemde kayıtlı değil. Devam etmek için talep oluşturun.");
    };

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [email, isSignUp]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || !signupEmail) return;
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: signupEmail });
      if (error) throw error;
      toast.success("Doğrulama e-postası tekrar gönderildi.");
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(err.message || "E-posta gönderilemedi. Lütfen daha sonra tekrar deneyin.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleDepartmentChange = async (val: string) => {
    setDepartment(val);
    setClassYear("");
    setErrors((prev) => ({ ...prev, department: "" }));
    setDeptValidation("idle");
    if (val) {
      setProgramYears(getProgramYearsForDepartment(val));
    } else {
      setProgramYears(4);
    }
  };

  const submitUnknownDomainRequest = async () => {
    if (!requestedUniversityName.trim() || !email.trim()) return;

    setRequestSending(true);
    setRequestResultMsg("");
    try {
      const requestEmail = email.trim().toLowerCase();
      const requestDomain = extractEmailDomain(requestEmail);
      const requestUniversity = requestedUniversityName.trim();
      const requestNoteValue = requestNote.trim() || null;

      const { data, error } = await supabase.rpc("create_university_domain_request", {
        p_request_email: requestEmail,
        p_claimed_university_name: requestUniversity,
        p_request_note: requestNoteValue,
      } as any);
      const rpcMissing =
        !!error &&
        ((error as any)?.code === "PGRST202" ||
          String((error as any)?.message || "").includes("Could not find the function"));

      if (error && !rpcMissing) throw error;

      if (rpcMissing) {
        const { data: existingPending } = await supabase
          .from("university_domain_requests" as any)
          .select("id")
          .eq("request_email_domain", requestDomain)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();

        if (existingPending?.id) {
          setRequestSubmitted(true);
          setRequestResultMsg("Bu domain için zaten bekleyen bir talep var. Admin incelemesini bekleyin.");
          return;
        }

        const { error: insertErr } = await supabase.from("university_domain_requests" as any).insert({
          request_email: requestEmail,
          request_email_domain: requestDomain,
          claimed_university_name: requestUniversity,
          request_note: requestNoteValue,
          status: "pending",
        });

        if (insertErr) throw insertErr;

        setRequestSubmitted(true);
        setRequestResultMsg("Talebiniz admin incelemesine gönderildi.");
        toast.success("Domain talebiniz gönderildi.");
        return;
      }

      if (data?.already_known && data?.university_name) {
        setDetectedUniversity(data.university_name);
        setUniversity(data.university_name);
        setDepartment("");
        setEmailError("");
        setRequestSubmitted(false);
        setRequestResultMsg("Bu domain bu sırada sisteme eklendi. Kayda devam edebilirsiniz.");
        return;
      }

      if (data?.ok) {
        setRequestSubmitted(true);
        setRequestResultMsg(data.reason || "Talebiniz admin incelemesine gönderildi.");
        toast.success("Domain talebiniz gönderildi.");
        return;
      }

      setRequestSubmitted(false);
      setRequestResultMsg(data?.reason || "Talep gönderilemedi.");
    } catch (err: any) {
      setRequestSubmitted(false);
      setRequestResultMsg(err?.message || "Talep gönderilirken bir hata oluştu.");
    } finally {
      setRequestSending(false);
    }
  };

  const validateDepartment = async () => {
    if (!customDepartment.trim() || !university) return;
    const applyDepartmentSelection = (name: string) => {
      const next = name.trim();
      if (!next) return;
      setDepartment(next);
      setClassYear("");
      setProgramYears(getProgramYearsForDepartment(next));
      setErrors((prev) => ({ ...prev, department: "" }));
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
        setTimeout(() => { setShowCustomDept(false); setCustomDepartment(""); }, 1500);
      } else if (result.status === "duplicate") {
        setDeptValidation("duplicate");
        setDeptValidationMsg(result.reason || "Bu bölüm zaten mevcut.");
        if (result.existing_name) {
          setTimeout(() => {
            applyDepartmentSelection(result.existing_name);
            setShowCustomDept(false);
            setCustomDepartment("");
            setDeptValidation("idle");
          }, 1200);
        }
      } else if (result.status === "pending_review") {
        setDeptValidation("pending_review");
        setDeptValidationMsg(result.reason || "Öneriniz admin incelemesine gönderildi.");
        applyDepartmentSelection(customDepartment.trim());
        if (isSignUp && result.requires_login_submission) {
          localStorage.setItem(
            "pending_department_suggestion",
            JSON.stringify({
              university: university.trim(),
              department: customDepartment.trim(),
            })
          );
        }
        setTimeout(() => { setShowCustomDept(false); setCustomDepartment(""); }, 1200);
      } else {
        setDeptValidation("rejected");
        setDeptValidationMsg(result.reason || "Bu bölüm doğrulanamadı.");
      }
    } catch {
      setDeptValidation("error");
      setDeptValidationMsg("Bölüm doğrulama servisine ulaşılamadı. Lütfen tekrar deneyin.");
    }
  };

  const verifyCaptcha = async (): Promise<boolean> => {
    if (!captchaToken) return true;
    try {
      const { data, error } = await supabase.functions.invoke("verify-turnstile", {
        body: { token: captchaToken },
      });
      if (error) throw error;
      return data?.success === true;
    } catch {
      return true;
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode,
      });
      if (verifyError) throw verifyError;
      markDeviceAsKnown();
      await logSecurityEvent("login_success", { method: "password+2fa", device: getDeviceInfo() });
      toast.success("Tekrar hoşgeldiniz!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Doğrulama kodu geçersiz.");
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (isSignUp) {
      if (!firstName.trim()) {
        newErrors.firstName = "Ad zorunludur.";
      }
      if (!lastName.trim()) {
        newErrors.lastName = "Soyad zorunludur.";
      }
      if (!username.trim() || username.trim().length < 3) {
        newErrors.username = "Kullanıcı adı en az 3 karakter olmalıdır.";
      }
      if (usernameStatus === "taken") {
        newErrors.username = "Bu kullanıcı adı zaten kullanılıyor.";
      }
      // Check username for profanity
      const usernameCheck = checkUsernameProfanity(username.trim());
      if (!usernameCheck.safe) {
        newErrors.username = "Bu kullanıcı adı uygunsuz içerik barındırıyor. Lütfen farklı bir ad seçin.";
      }
      if (!isPasswordStrong(password)) {
        newErrors.password = "Şifre güvenlik gereksinimlerini karşılamıyor.";
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "Şifreler eşleşmiyor.";
      }
      const domain = extractEmailDomain(email);
      if (!domain.endsWith(".edu.tr") && !domain.endsWith(".edu")) {
        newErrors.email = "Sadece Türkiye ve KKTC üniversitelerine ait e-posta adresleri ile kayıt olabilirsiniz.";
      }

      if (!university) {
        newErrors.university = "Üniversite seçimi zorunludur.";
      }
      if (!department) {
        newErrors.department = "Bölüm seçimi zorunludur.";
      }
      if (!acceptTerms) {
        newErrors.terms = "Kullanım koşullarını kabul etmelisiniz.";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const captchaValid = await verifyCaptcha();
      if (!captchaValid) {
        toast.error("CAPTCHA doğrulaması başarısız. Tekrar deneyin.");
        return;
      }

      if (isSignUp) {
        // Check 3-day email cooldown for deleted accounts
        const { data: deletedCheck } = await supabase
          .from("deleted_emails")
          .select("cooldown_until")
          .eq("email", email.toLowerCase())
          .gte("cooldown_until", new Date().toISOString())
          .limit(1);
        if (deletedCheck && deletedCheck.length > 0) {
          const cooldownEnd = new Date((deletedCheck[0] as any).cooldown_until);
          const hoursLeft = Math.ceil((cooldownEnd.getTime() - Date.now()) / (1000 * 60 * 60));
          toast.error(`Bu e-posta adresi yakın zamanda silinen bir hesaba aittir. ${hoursLeft > 24 ? Math.ceil(hoursLeft / 24) + " gün" : hoursLeft + " saat"} sonra tekrar kayıt olabilirsiniz.`);
          setLoading(false);
          return;
        }

        const sanitizedUsername = sanitizeInput(username.trim().toLowerCase());
        const sanitizedFirstName = sanitizeInput(firstName.trim());
        const sanitizedLastName = sanitizeInput(lastName.trim());
        const displayName = `${sanitizedFirstName} ${sanitizedLastName}`;

        // check-username edge function ile son kontrol (DB blocklist + uniqueness + AI)
        const { data: usernameCheckData, error: usernameCheckError } = await supabase.functions.invoke("check-username", {
          body: { username: sanitizedUsername },
        });
        if (usernameCheckError || usernameCheckData?.available === false) {
          toast.error(usernameCheckData?.reason || "Bu kullanıcı adı kullanılamıyor. Lütfen farklı bir kullanıcı adı seçin.");
          setLoading(false);
          return;
        }

        await signUp(email, password, sanitizedUsername);
        await logSecurityEvent("signup", { email, device: getDeviceInfo() });
        const domain = extractEmailDomain(email);
        localStorage.setItem(
          "pending_profile",
          JSON.stringify({
            display_name: displayName || null,
            university: university.trim() || null,
            department: department.trim() || null,
            class_year: classYear ? parseInt(classYear) : null,
            bio: sanitizeInput(bio.trim()) || null,
            email_domain: domain || null,
          })
        );
        setPassword("");
        setConfirmPassword("");
        setUsername("");
        setFirstName("");
        setLastName("");
        setAcceptTerms(false);
        setSignupComplete(true);
        setSignupEmail(email);
        return;
      } else {
        const lockout = await checkLoginLockout(email);
        if (lockout.locked) {
          toast.error(`Çok fazla başarısız giriş denemesi. ${lockout.minutesLeft} dakika sonra tekrar deneyin.`);
          await logSecurityEvent("account_locked", { email });
          return;
        }
        try {
          await signIn(email, password);
          await recordLoginAttempt(email, true);
          const deviceInfo = getDeviceInfo();
          const newDevice = isNewDevice();
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totpFactor = factors?.totp?.find((f) => f.status === "verified");
          if (totpFactor) {
            setMfaFactorId(totpFactor.id);
            setMfaRequired(true);
            if (newDevice) setNewDeviceWarning(true);
            return;
          }
          if (newDevice) {
            await logSecurityEvent("suspicious_login", { reason: "new_device", device: deviceInfo });
            setNewDeviceWarning(true);
          }
          markDeviceAsKnown();
          await logSecurityEvent("login_success", { method: "password", device: deviceInfo, newDevice });
          // Apply pending profile from registration
          const pending = localStorage.getItem("pending_profile");
          if (pending) {
            try {
              const data = JSON.parse(pending);
              const { data: { user } } = await supabase.auth.getUser();
               if (user) {
                 await supabase.from("profiles").update(data).eq("user_id", user.id);
                 // Auto-add new university to universities table if not exists
                 if (data.university) {
                   const { data: existing } = await supabase
                     .from("universities")
                     .select("id")
                     .eq("name", data.university)
                     .maybeSingle();
                   if (!existing) {
                     await supabase.from("universities").insert({
                       name: data.university,
                       created_by: user.id,
                     } as any);
                   }
                 }
               }
            } catch {
              toast.error("Profil bilgileri kaydedilemedi. Lütfen profil sayfanızdan bilgilerinizi güncelleyin.");
            }
            localStorage.removeItem("pending_profile");
          }
          const pendingDept = localStorage.getItem("pending_department_suggestion");
          if (pendingDept) {
            try {
              const parsed = JSON.parse(pendingDept);
              const pendingUniversity = String(parsed?.university || "").trim();
              const pendingDepartment = String(parsed?.department || "").trim();
              const { data: { user } } = await supabase.auth.getUser();

              if (user && pendingUniversity && pendingDepartment) {
                const { data: existingDept } = await supabase
                  .from("departments")
                  .select("id")
                  .eq("university", pendingUniversity)
                  .eq("name", pendingDepartment)
                  .maybeSingle();

                if (!existingDept) {
                  const { data: existingSuggestion } = await supabase
                    .from("academic_suggestions")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("type", "department")
                    .eq("university", pendingUniversity)
                    .eq("department", pendingDepartment)
                    .in("status", ["pending", "approved"])
                    .limit(1)
                    .maybeSingle();

                  if (!existingSuggestion) {
                    await supabase.from("academic_suggestions").insert({
                      user_id: user.id,
                      type: "department",
                      university: pendingUniversity,
                      department: pendingDepartment,
                      status: "pending",
                      ai_confidence: null,
                      ai_reason: "Signup sırasında doğrulama servisi kullanılamadığı için login sonrası kuyruğa alındı.",
                      normalized_name: pendingDepartment,
                    } as any);
                    toast.info("Bölüm öneriniz admin incelemesine gönderildi.");
                  }
                }
              }
            } catch {
              // no-op: pending suggestion queue is best effort
            }
            localStorage.removeItem("pending_department_suggestion");
          }
          if (newDevice) {
            toast.info("Yeni bir cihazdan giriş yaptınız. 2FA etkinleştirmenizi öneriyoruz.", { duration: 8000 });
          } else {
            toast.success("Tekrar hoşgeldiniz!");
          }
          navigate("/");
        } catch (loginErr: any) {
          await recordLoginAttempt(email, false);
          await logSecurityEvent("login_failed", { email, device: getDeviceInfo() });
          throw loginErr;
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Kimlik doğrulama başarısız");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setEmailError("");
    setRequestResultMsg("");
    setRequestSubmitted(false);
    setRequestedUniversityName("");
    setRequestNote("");
    setConfirmPassword("");
    setAcceptTerms(false);
  };

  if (mfaRequired) {
    return (
      <MfaForm
        loading={loading} mfaCode={mfaCode} setMfaCode={setMfaCode}
        newDeviceWarning={newDeviceWarning} onSubmit={handleMfaVerify}
        onBack={() => { setMfaRequired(false); setMfaCode(""); setNewDeviceWarning(false); }}
      />
    );
  }

  if (signupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8 bg-background">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="border-0 bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-elevated)' }}>
            <div className="h-1.5 w-full gradient-hero" />
            <CardHeader className="text-center pb-2 pt-8">
              <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-2xl bg-success/10 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-success" />
                </div>
              </div>
              <CardTitle className="font-heading text-xl font-extrabold">E-postanızı Doğrulayın</CardTitle>
              <CardDescription className="text-sm mt-2">
                <span className="font-semibold text-foreground">{signupEmail}</span> adresine bir doğrulama bağlantısı gönderdik.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                   <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <p className="font-semibold text-warning-foreground">Üniversite e-postası kullanıyorsanız:</p>
                    <ul className="mt-1 space-y-0.5 text-warning-foreground">
                      <li>• <strong>Spam/Gereksiz</strong> klasörünüzü mutlaka kontrol edin</li>
                      <li>• E-posta gelmesi birkaç dakika sürebilir</li>
                      <li>• Üniversitenizin e-posta sistemi gecikmelere yol açabilir</li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <p>E-postayı bulamıyorsanız aşağıdaki butona tıklayarak tekrar gönderebilirsiniz.</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleResendVerification}
                variant="outline"
                className="w-full h-10 rounded-lg font-semibold text-sm"
                disabled={resendLoading || resendCooldown > 0}
              >
                {resendLoading ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Gönderiliyor...</span>
                ) : resendCooldown > 0 ? (
                  `Tekrar gönder (${resendCooldown}s)`
                ) : (
                  "Doğrulama E-postasını Tekrar Gönder"
                )}
              </Button>

              <Button
                onClick={() => { setSignupComplete(false); setIsSignUp(false); }}
                className="w-full h-10 rounded-lg font-semibold text-sm"
              >
                Giriş Sayfasına Dön
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const passwordsMatch = isSignUp && confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = isSignUp && confirmPassword.length > 0 && password !== confirmPassword;
  const isAcademicEmailDomain = emailDomain.endsWith(".edu.tr") || emailDomain.endsWith(".edu");
  const isHardEmailRejection = emailError.startsWith("Sadece Türkiye ve KKTC");
  const shouldShowUnknownDomainRequest =
    isSignUp &&
    !!email &&
    isAcademicEmailDomain &&
    !detectedUniversity &&
    !isHardEmailRejection;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <Card className="border-0 bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          {/* Decorative top bar */}
          <div className="h-1.5 w-full gradient-hero" />

          <CardHeader className="text-center pb-2 pt-6">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-2xl gradient-hero flex items-center justify-center" style={{ boxShadow: 'var(--shadow-card)' }}>
                <GraduationCap className="h-7 w-7 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="font-heading text-2xl font-extrabold tracking-tight">
              {isSignUp ? "Hesap Oluştur" : "Tekrar Hoşgeldiniz"}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {isSignUp ? "Üniversite e-postanızla güvenli kayıt olun" : "Hesabınıza güvenli giriş yapın"}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ── FIRST NAME & LAST NAME (signup only) ── */}
              <AnimatePresence>
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 gap-3 overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="firstName" className="text-xs font-semibold">
                        Ad <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Adınız"
                        required
                        maxLength={50}
                        className="h-10 rounded-lg"
                        autoComplete="given-name"
                      />
                      {errors.firstName && <p className="text-[10px] text-destructive">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastName" className="text-xs font-semibold">
                        Soyad <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Soyadınız"
                        required
                        maxLength={50}
                        className="h-10 rounded-lg"
                        autoComplete="family-name"
                      />
                      {errors.lastName && <p className="text-[10px] text-destructive">{errors.lastName}</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── USERNAME (signup only) ── */}
              <AnimatePresence>
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <Label htmlFor="username" className="text-xs font-semibold flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      Kullanıcı Adı <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())}
                        placeholder="kullaniciadi"
                        required
                        maxLength={30}
                        className="h-10 rounded-lg pr-9"
                        autoComplete="username"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus === "checking" && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
                        {usernameStatus === "available" && <CheckCircle2 className="h-4 w-4 text-success" />}
                        {(usernameStatus === "taken" || usernameStatus === "inappropriate") && <XCircle className="h-4 w-4 text-destructive" />}
                      </div>
                    </div>
                    {usernameStatus === "taken" && (
                      <p className="text-[10px] text-destructive">Bu kullanıcı adı zaten kullanılıyor.</p>
                    )}
                    {usernameStatus === "inappropriate" && (
                      <p className="text-[10px] text-destructive">Bu kullanıcı adı uygunsuz içerik barındırıyor. Lütfen farklı bir ad seçin.</p>
                    )}
                    {usernameStatus === "available" && (
                      <p className="text-[10px] text-success">Kullanıcı adı müsait ✓</p>
                    )}
                    {errors.username && <p className="text-[10px] text-destructive">{errors.username}</p>}
                    <p className="text-[10px] text-muted-foreground">Sadece harf, rakam ve alt çizgi. 30 günde bir değiştirilebilir.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── EMAIL ── */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {isSignUp ? "Üniversite E-postası" : "E-posta"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isSignUp ? "isim@universite.edu.tr" : "ornek@email.com"}
                  required
                  className="h-10 rounded-lg"
                  autoComplete="email"
                />
                {isSignUp && !emailError && !detectedUniversity && email && (
                  <div className="flex items-start gap-1.5 mt-1">
                    <Info className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground">
                      Üniversite e-posta adresinizi kullanın (örn: isim@ege.edu.tr)
                    </p>
                  </div>
                )}
                {isSignUp && detectedUniversity && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-1.5 p-2.5 rounded-lg bg-success/10 border border-success/20 mt-1"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-semibold text-success">✓ Üniversite algılandı: {detectedUniversity}</p>
                      <p className="text-[9px] text-success/80">E-posta domain eşleşmesi ile üniversiteniz otomatik bağlanacaktır.</p>
                    </div>
                  </motion.div>
                )}
                {shouldShowUnknownDomainRequest && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-3 rounded-lg bg-warning/5 border border-warning/20 mt-1"
                  >
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                      <p className="text-[10px] text-warning-foreground">
                        Bu e-posta domaini henüz sistemde kayıtlı değil. Kayda devam etmeden önce talep oluşturmalısınız.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bu e-posta hangi üniversiteye ait?</Label>
                      <Input
                        value={requestedUniversityName}
                        onChange={(e) => setRequestedUniversityName(e.target.value)}
                        placeholder="Örn: Yakın Doğu Üniversitesi"
                        className="h-9 text-sm"
                        maxLength={200}
                        disabled={requestSending || requestSubmitted}
                      />
                      <Label className="text-xs font-semibold">Not (opsiyonel)</Label>
                      <Input
                        value={requestNote}
                        onChange={(e) => setRequestNote(e.target.value)}
                        placeholder="Örn: Domain neu.edu.tr"
                        className="h-9 text-sm"
                        maxLength={200}
                        disabled={requestSending || requestSubmitted}
                      />
                      {requestResultMsg && (
                        <p className={`text-[10px] ${requestSubmitted ? "text-success" : "text-muted-foreground"}`}>
                          {requestResultMsg}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="text-xs flex-1"
                          disabled={!requestedUniversityName.trim() || requestSending || requestSubmitted}
                          onClick={submitUnknownDomainRequest}
                        >
                          {requestSending ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Gönderiliyor</>
                          ) : (
                            "Talep Oluştur"
                          )}
                        </Button>
                      </div>
                      <p className="text-[9px] text-muted-foreground">Admin onayı olmadan bu domain ile signup tamamlanamaz.</p>
                    </div>
                  </motion.div>
                )}
                {isSignUp && emailError && (
                  <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[10px] text-destructive">{emailError}</p>
                  </div>
                )}
                {errors.email && <p className="text-[10px] text-destructive">{errors.email}</p>}
              </div>

              {/* ── PASSWORD ── */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  Şifre <span className="text-destructive">*</span>
                </Label>
                <PasswordInput id="password" value={password} onChange={setPassword} />
                {isSignUp && <PasswordStrengthIndicator password={password} />}
                {errors.password && <p className="text-[10px] text-destructive">{errors.password}</p>}
              </div>

              {/* ── CONFIRM PASSWORD (signup) ── */}
              <AnimatePresence>
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-1.5 overflow-hidden"
                  >
                    <Label htmlFor="confirmPassword" className="text-xs font-semibold flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                      Şifreyi Onayla <span className="text-destructive">*</span>
                    </Label>
                    <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} />
                    {passwordsMatch && (
                      <p className="text-[10px] text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Şifreler eşleşiyor
                      </p>
                    )}
                    {passwordsMismatch && (
                      <p className="text-[10px] text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Şifreler eşleşmiyor
                      </p>
                    )}
                    {errors.confirmPassword && <p className="text-[10px] text-destructive">{errors.confirmPassword}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── FORGOT PASSWORD (login) ── */}
              {!isSignUp && (
                <div className="text-right -mt-1">
                  <Link to="/forgot-password" className="text-[11px] text-primary font-semibold hover:underline">
                    Şifremi unuttum
                  </Link>
                </div>
              )}

              {/* ── ACADEMIC INFO (signup, after detection) ── */}
              <AnimatePresence>
                {isSignUp && detectedUniversity && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="pt-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5" />
                        Akademik Bilgiler
                      </p>
                    </div>

                    {/* University (locked) */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Üniversite <span className="text-destructive">*</span></Label>
                      <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-secondary/50 border border-input">
                        <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{university}</span>
                        <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                      </div>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        E-postadan otomatik algılandı. Admin onayı ile değiştirilebilir.
                      </p>
                      {errors.university && <p className="text-[10px] text-destructive">{errors.university}</p>}
                    </div>

                    {/* Department */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Bölüm <span className="text-destructive">*</span></Label>
                      <SearchableSelect
                        value={department}
                        onValueChange={handleDepartmentChange}
                        placeholder="Bölüm seçin"
                        searchPlaceholder="Bölüm ara..."
                        options={departmentOptions}
                        error={errors.department}
                      />
                      <button
                        type="button"
                        onClick={() => { setShowCustomDept(true); setDeptValidation("idle"); setDeptValidationMsg(""); }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 hover:border-primary/50 transition-all"
                      >
                        <Search className="h-3.5 w-3.5" />
                        Bölümümü Bulamadım
                      </button>

                      {showCustomDept && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 rounded-lg bg-secondary/50 border text-left space-y-2"
                        >
                          <Label className="text-xs font-semibold">Bölüm adını girin</Label>
                          <Input
                            value={customDepartment}
                            onChange={(e) => { setCustomDepartment(e.target.value); setDeptValidation("idle"); }}
                            placeholder="Örn: Bilgisayar Mühendisliği"
                            className="h-9 text-sm"
                            maxLength={200}
                            disabled={deptValidation === "validating"}
                          />
                          <ValidationFeedback status={deptValidation} message={deptValidationMsg} />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-xs flex-1"
                              onClick={() => { setShowCustomDept(false); setCustomDepartment(""); setDeptValidation("idle"); }}
                              disabled={deptValidation === "validating"}
                            >
                              İptal
                            </Button>
                            <Button
                              type="button"
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
                          <p className="text-[9px] text-muted-foreground">Yapay zeka ile doğrulanacak.</p>
                        </motion.div>
                      )}

                       <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Kayıt sonrası admin onayı ile değiştirilebilir.
                      </p>
                    </div>

                    {/* Year + Bio row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Sınıf</Label>
                        <Select value={classYear} onValueChange={setClassYear}>
                          <SelectTrigger className="h-9 text-sm rounded-lg">
                            <SelectValue placeholder="Seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Hazırlık</SelectItem>
                            {Array.from({ length: programYears }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>
                                {i + 1}. Sınıf
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Hakkımda</Label>
                        <Input
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Kısa açıklama"
                          maxLength={100}
                          className="h-9 text-sm rounded-lg"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Warning for invalid domain */}
              {isSignUp && !detectedUniversity && !shouldShowUnknownDomainRequest && email && emailDomain && emailError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <Mail className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-[10px] text-warning-foreground">
                    Kayıt olmak için geçerli bir üniversite e-posta adresi gereklidir.
                    E-postanızın <strong>@universite.edu.tr</strong> formatında olduğundan emin olun.
                  </p>
                </div>
              )}

              {/* ── TERMS (signup) ── */}
              {isSignUp && (
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="terms"
                      checked={acceptTerms}
                      onCheckedChange={(v) => setAcceptTerms(v === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="terms" className="text-[11px] text-muted-foreground leading-tight cursor-pointer">
                      <button type="button" onClick={() => setShowTerms(true)} className="text-primary font-semibold hover:underline">Kullanım Koşulları</button> ve{" "}
                      <button type="button" onClick={() => setShowPrivacy(true)} className="text-primary font-semibold hover:underline">Gizlilik Politikası</button>'nı
                      okudum ve kabul ediyorum.
                    </label>
                  </div>
                  {errors.terms && <p className="text-[10px] text-destructive">{errors.terms}</p>}
                </div>
              )}

              {/* CAPTCHA */}
              <TurnstileWidget onVerify={(token) => setCaptchaToken(token)} onExpire={() => setCaptchaToken(null)} />

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-11 rounded-lg font-semibold text-sm"
                disabled={loading || (isSignUp && !detectedUniversity) || (isSignUp && (usernameStatus === "taken" || usernameStatus === "inappropriate" || usernameStatus === "checking"))}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
                  </span>
                ) : isSignUp ? (
                  "Kayıt Ol"
                ) : (
                  "Giriş Yap"
                )}
              </Button>

              {/* Security info banner (signup) */}
              {isSignUp && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p className="font-semibold text-foreground">Güvenlik Bilgisi</p>
                    <p>• E-postanıza doğrulama kodu gönderilecektir</p>
                    <p>• Üniversite ve bölüm bilgileriniz kayıt sonrası admin onayı ile değiştirilebilir</p>
                    <p>• Sadece kendi üniversitenizin derslerine içerik ekleyebilirsiniz</p>
                  </div>
                </div>
              )}
            </form>

            {/* Toggle signup/login */}
            <div className="mt-5 text-center text-sm text-muted-foreground">
              {isSignUp ? "Zaten hesabınız var mı?" : "Hesabınız yok mu?"}{" "}
              <button onClick={switchMode} className="text-primary font-semibold hover:underline">
                {isSignUp ? "Giriş Yap" : "Kayıt Ol"}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer text */}
        <p className="text-center text-[10px] text-muted-foreground mt-4 px-4">
          Verileriniz şifrelenerek güvenli sunucularda saklanır. Şifreniz bcrypt ile hash'lenir.
        </p>
      </motion.div>

      {/* Terms of Service Modal */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 font-heading text-lg">
              <FileText className="h-5 w-5 text-primary" />
              Kullanım Koşulları
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[65vh]">
            <div className="space-y-4 text-sm text-muted-foreground">
              <p className="text-[10px]">Son güncelleme: 8 Mart 2026</p>
              <h3 className="text-foreground font-semibold text-base">1. Hizmet Tanımı</h3>
              <p>Bu platform, Türkiye'deki üniversite öğrencilerinin ders notlarını, sınav sorularını ve akademik kaynakları paylaşmaları için tasarlanmış bir akademik işbirliği platformudur. Platform, yalnızca geçerli bir üniversite e-posta adresi (.edu.tr) ile kayıt olan kullanıcılara hizmet vermektedir.</p>
              <h3 className="text-foreground font-semibold text-base">2. Kullanıcı Hesabı ve Sorumluluklar</h3>
              <p>Kullanıcılar, kayıt sırasında sağladıkları bilgilerin doğruluğundan sorumludur. Her kullanıcı yalnızca bir hesap açabilir. Hesap bilgileri (üniversite, bölüm) kayıt sonrası admin onayı ile değiştirilebilir. Kullanıcılar, hesap güvenliğinden ve şifrelerinin gizliliğinden kendileri sorumludur.</p>
              <h3 className="text-foreground font-semibold text-base">3. İçerik Politikası</h3>
              <p>Kullanıcılar yalnızca kendi üniversitelerine ait bölümlere içerik ekleyebilir. Paylaşılan tüm içerikler telif hakkı yasalarına uygun olmalıdır. Platform, uygunsuz içerikleri önceden haber vermeksizin kaldırma hakkını saklı tutar.</p>
              <h3 className="text-foreground font-semibold text-base">4. Fikri Mülkiyet</h3>
              <p>Kullanıcılar paylaştıkları içeriklerin fikri mülkiyet haklarına sahip olmalı veya paylaşım izni almış olmalıdır. Platformda paylaşılan içerikler, içerik sahibinin mülkiyetinde kalır.</p>
              <h3 className="text-foreground font-semibold text-base">5. Yasaklanan Davranışlar</h3>
              <p>Platformda spam, hakaret, taciz, nefret söylemi ve diğer zararlı davranışlar kesinlikle yasaktır. Başka kullanıcıların hesaplarına yetkisiz erişim girişimleri ve otomatik veri toplama (scraping) yasaktır.</p>
              <h3 className="text-foreground font-semibold text-base">6. Hesap Askıya Alma</h3>
              <p>Platform, kullanım koşullarını ihlal eden hesapları geçici veya kalıcı olarak askıya alma hakkını saklı tutar.</p>
              <h3 className="text-foreground font-semibold text-base">7. Sorumluluk Sınırlaması</h3>
              <p>Platform, kullanıcılar tarafından paylaşılan içeriklerin doğruluğu veya kalitesi konusunda garanti vermez. Platform, hizmet kesintileri veya veri kayıplarından kaynaklanan zararlardan sorumlu tutulamaz.</p>
              <h3 className="text-foreground font-semibold text-base">8. Değişiklikler</h3>
              <p>Bu koşullar önceden haber verilerek güncellenebilir. Platformu kullanmaya devam etmek, güncellenmiş koşulları kabul ettiğiniz anlamına gelir.</p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 font-heading text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Gizlilik Politikası
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[65vh]">
            <div className="space-y-4 text-sm text-muted-foreground">
              <p className="text-[10px]">Son güncelleme: 8 Mart 2026</p>
              <h3 className="text-foreground font-semibold text-base">1. Toplanan Veriler</h3>
              <p>Kayıt sırasında: e-posta adresi, kullanıcı adı, üniversite, bölüm ve sınıf bilgileri toplanır. Kullanım sırasında: IP adresi, tarayıcı bilgisi, oturum verileri ve platform içi aktiviteler kaydedilir.</p>
              <h3 className="text-foreground font-semibold text-base">2. Verilerin Kullanım Amacı</h3>
              <p>Toplanan veriler hesap doğrulama, üniversiteye özgü içerik erişim kontrolü, platform güvenliğinin sağlanması ve hizmet kalitesinin iyileştirilmesi amacıyla kullanılır.</p>
              <h3 className="text-foreground font-semibold text-base">3. Veri Güvenliği</h3>
              <p>Şifreler endüstri standardı bcrypt algoritması ile hash'lenir. Tüm iletişimler TLS/HTTPS ile korunur. Veritabanı erişimi Row-Level Security politikaları ile sınırlandırılmıştır.</p>
              <h3 className="text-foreground font-semibold text-base">4. Veri Paylaşımı</h3>
              <p>Kişisel verileriniz üçüncü taraflarla paylaşılmaz. Yasal zorunluluk durumları hariç, veriler yalnızca platform hizmetleri için kullanılır.</p>
              <h3 className="text-foreground font-semibold text-base">5. Kullanıcı Hakları (KVKK)</h3>
              <p>6698 sayılı KVKK kapsamında: kişisel verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini talep etme, aktarıldığı üçüncü kişileri bilme ve itiraz etme haklarına sahipsiniz.</p>
              <h3 className="text-foreground font-semibold text-base">6. Çerezler</h3>
              <p>Platform, oturum yönetimi için gerekli çerezler kullanır. HTTP-only ve SameSite korumalarıyla güvence altına alınmıştır. Üçüncü taraf izleme çerezleri kullanılmamaktadır.</p>
              <h3 className="text-foreground font-semibold text-base">7. Veri Saklama Süresi</h3>
              <p>Hesap verileri aktif olduğu sürece, güvenlik logları 90 gün saklanır. Hesap silinmesinde kişisel veriler 30 gün içinde kalıcı olarak silinir.</p>
              <h3 className="text-foreground font-semibold text-base">8. İletişim</h3>
              <p>Gizlilik ile ilgili sorularınız için platform üzerinden destek ekibimize ulaşabilirsiniz.</p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
