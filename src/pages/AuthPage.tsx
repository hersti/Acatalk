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
import AcademicProgramRequestDialog from "@/components/AcademicProgramRequestDialog";
import { extractEmailDomain } from "@/lib/email-domain";
import {
  fetchAcademicProgramsForUniversity,
  inferProgramYears,
  resolveUniversityByName,
  type AcademicProgramRow,
} from "@/lib/academic-catalog";
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
  FileText, Shield,
} from "lucide-react";
import { toast } from "sonner";

/* â”€â”€â”€ MFA Sub-form â”€â”€â”€ */
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
            <CardTitle className="font-heading text-xl font-extrabold">Ä°ki FaktÃ¶rlÃ¼ DoÄŸrulama</CardTitle>
            <CardDescription className="text-xs">Authenticator uygulamanÄ±zdaki 6 haneli kodu girin.</CardDescription>
          </CardHeader>
          <CardContent>
            {newDeviceWarning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 mb-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-[11px] text-warning-foreground">
                  Yeni bir cihazdan giriÅŸ yapÄ±yorsunuz. KimliÄŸinizi doÄŸrulayÄ±n.
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
                {loading ? "DoÄŸrulanÄ±yor..." : "DoÄŸrula"}
              </Button>
            </form>
            <div className="mt-3 text-center">
              <button onClick={onBack} className="text-xs text-muted-foreground hover:underline">Geri dÃ¶n</button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/* â”€â”€â”€ Password Input with toggle â”€â”€â”€ */
function PasswordInput({
  id, value, onChange, placeholder = "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢", required = true, className = "",
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
        aria-label={show ? "Åifreyi gizle" : "Åifreyi gÃ¶ster"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* â”€â”€â”€ Username availability & profanity hook â”€â”€â”€ */
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

/* â”€â”€â”€ Main Component â”€â”€â”€ */
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
  const [detectedUniversityId, setDetectedUniversityId] = useState<string | null>(null);
  const [detectedUniversity, setDetectedUniversity] = useState<string | null>(null);
  const [emailDomain, setEmailDomain] = useState("");
  const [emailError, setEmailError] = useState("");

  // Unknown domain request (admin-approved)
  const [requestedUniversityName, setRequestedUniversityName] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [requestResultMsg, setRequestResultMsg] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  // Missing program request (admin-approved queue)
  const [showProgramRequestDialog, setShowProgramRequestDialog] = useState(false);

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

  const [programRows, setProgramRows] = useState<AcademicProgramRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    if (!university) {
      setProgramRows([]);
      return () => {
        cancelled = true;
      };
    }

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
  }, [university]);

  const departmentOptions = (() => {
    const allDepts = [...new Set(programRows.map((row) => row.program_name))].sort((a, b) =>
      a.localeCompare(b, "tr")
    );
    return allDepts.map((d) => ({ label: d }));
  })();

  const selectedProgram = programRows.find((row) => row.program_name === department) || null;

  useEffect(() => {
    if (!department) return;
    if (programRows.some((row) => row.program_name === department)) return;
    setDepartment("");
    setClassYear("");
    setProgramYears(4);
  }, [department, programRows]);

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
        university_id: uniRow.id,
        university_name: uniRow.name,
      };
    };

    if (!isSignUp || !email.trim()) {
      setDetectedUniversityId(null);
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
      setDetectedUniversityId(null);
      setDetectedUniversity(null);
      setUniversity("");
      setEmailError("");
      return;
    }

    if (!domain.endsWith(".edu.tr") && !domain.endsWith(".edu")) {
      setDetectedUniversityId(null);
      setDetectedUniversity(null);
      setUniversity("");
      setEmailError("Sadece TÃ¼rkiye ve KKTC Ã¼niversitelerine ait e-posta adresleriyle kayÄ±t olabilirsiniz.");
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
        if (fallbackResolved?.found && fallbackResolved?.university_name && fallbackResolved?.university_id) {
          setDetectedUniversityId(fallbackResolved.university_id);
          setDetectedUniversity(fallbackResolved.university_name);
          setUniversity(fallbackResolved.university_name);
          setDepartment("");
          setClassYear("");
          setProgramYears(4);
          setEmailError("");
          setRequestedUniversityName("");
          setRequestNote("");
          return;
        }

        setDetectedUniversityId(null);
        setDetectedUniversity(null);
        setUniversity("");
        setEmailError("Domain doğrulama servisi şu an yanıt vermiyor. Bu alan için talep oluşturabilirsiniz.");
        return;
      }

      const resolved = Array.isArray(data) ? data[0] : (data && typeof data === "object" ? data : null);
      if (resolved?.found && resolved?.university_name) {
        const resolvedUniId =
          typeof resolved?.university_id === "string" && resolved.university_id
            ? resolved.university_id
            : (await resolveUniversityByName(resolved.university_name))?.id || null;

        if (!resolvedUniId) {
          setDetectedUniversityId(null);
          setDetectedUniversity(null);
          setUniversity("");
          setDepartment("");
          setClassYear("");
          setProgramYears(4);
          setEmailError("Üniversite kaydı çözülemedi. Lütfen daha sonra tekrar deneyin.");
          return;
        }

        setDetectedUniversityId(resolvedUniId);
        setDetectedUniversity(resolved.university_name);
        setUniversity(resolved.university_name);
        setDepartment("");
        setClassYear("");
        setProgramYears(4);
        setEmailError("");
        setRequestedUniversityName("");
        setRequestNote("");
        return;
      }

      setDetectedUniversityId(null);
      setDetectedUniversity(null);
      setUniversity("");
      setDepartment("");
      setClassYear("");
      setProgramYears(4);
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
      toast.success("DoÄŸrulama e-postasÄ± tekrar gÃ¶nderildi.");
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(err.message || "E-posta gÃ¶nderilemedi. LÃ¼tfen daha sonra tekrar deneyin.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleDepartmentChange = (val: string) => {
    setDepartment(val);
    setClassYear("");
    setErrors((prev) => ({ ...prev, department: "" }));
    if (val) {
      const selected = programRows.find((row) => row.program_name === val);
      setProgramYears(selected?.program_years || inferProgramYears(val, selected?.program_level));
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
          setRequestResultMsg("Bu domain iÃ§in zaten bekleyen bir talep var. Admin incelemesini bekleyin.");
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
        setRequestResultMsg("Talebiniz admin incelemesine gÃ¶nderildi.");
        toast.success("Domain talebiniz gÃ¶nderildi.");
        return;
      }

      if (data?.already_known && data?.university_name) {
        const resolvedUni = await resolveUniversityByName(data.university_name);
        setDetectedUniversityId(resolvedUni?.id || null);
        setDetectedUniversity(data.university_name);
        setUniversity(data.university_name);
        setDepartment("");
        setClassYear("");
        setProgramYears(4);
        setEmailError("");
        setRequestSubmitted(false);
        setRequestResultMsg("Bu domain bu sÄ±rada sisteme eklendi. Kayda devam edebilirsiniz.");
        return;
      }

      if (data?.ok) {
        setRequestSubmitted(true);
        setRequestResultMsg(data.reason || "Talebiniz admin incelemesine gÃ¶nderildi.");
        toast.success("Domain talebiniz gÃ¶nderildi.");
        return;
      }

      setRequestSubmitted(false);
      setRequestResultMsg(data?.reason || "Talep gÃ¶nderilemedi.");
    } catch (err: any) {
      setRequestSubmitted(false);
      setRequestResultMsg(err?.message || "Talep gÃ¶nderilirken bir hata oluÅŸtu.");
    } finally {
      setRequestSending(false);
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
      toast.success("Tekrar hoÅŸgeldiniz!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "DoÄŸrulama kodu geÃ§ersiz.");
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
        newErrors.username = "KullanÄ±cÄ± adÄ± en az 3 karakter olmalÄ±dÄ±r.";
      }
      if (usernameStatus === "taken") {
        newErrors.username = "Bu kullanÄ±cÄ± adÄ± zaten kullanÄ±lÄ±yor.";
      }
      // Check username for profanity
      const usernameCheck = checkUsernameProfanity(username.trim());
      if (!usernameCheck.safe) {
        newErrors.username = "Bu kullanÄ±cÄ± adÄ± uygunsuz iÃ§erik barÄ±ndÄ±rÄ±yor. LÃ¼tfen farklÄ± bir ad seÃ§in.";
      }
      if (!isPasswordStrong(password)) {
        newErrors.password = "Åifre gÃ¼venlik gereksinimlerini karÅŸÄ±lamÄ±yor.";
      }
      if (password !== confirmPassword) {
        newErrors.confirmPassword = "Åifreler eÅŸleÅŸmiyor.";
      }
      const domain = extractEmailDomain(email);
      if (!domain.endsWith(".edu.tr") && !domain.endsWith(".edu")) {
        newErrors.email = "Sadece TÃ¼rkiye ve KKTC Ã¼niversitelerine ait e-posta adresleri ile kayÄ±t olabilirsiniz.";
      }

      if (!university) {
        newErrors.university = "Ãœniversite seÃ§imi zorunludur.";
      }
      if (!department) {
        newErrors.department = "BÃ¶lÃ¼m seÃ§imi zorunludur.";
      }
      if (!acceptTerms) {
        newErrors.terms = "KullanÄ±m koÅŸullarÄ±nÄ± kabul etmelisiniz.";
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
        toast.error("CAPTCHA doÄŸrulamasÄ± baÅŸarÄ±sÄ±z. Tekrar deneyin.");
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
          toast.error(`Bu e-posta adresi yakÄ±n zamanda silinen bir hesaba aittir. ${hoursLeft > 24 ? Math.ceil(hoursLeft / 24) + " gÃ¼n" : hoursLeft + " saat"} sonra tekrar kayÄ±t olabilirsiniz.`);
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
          toast.error(usernameCheckData?.reason || "Bu kullanÄ±cÄ± adÄ± kullanÄ±lamÄ±yor. LÃ¼tfen farklÄ± bir kullanÄ±cÄ± adÄ± seÃ§in.");
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
            university_id: detectedUniversityId || null,
            department: department.trim() || null,
            academic_program_id: selectedProgram?.id || null,
            program_level: selectedProgram?.program_level || null,
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
          toast.error(`Ã‡ok fazla baÅŸarÄ±sÄ±z giriÅŸ denemesi. ${lockout.minutesLeft} dakika sonra tekrar deneyin.`);
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
               }
            } catch {
              toast.error("Profil bilgileri kaydedilemedi. LÃ¼tfen profil sayfanÄ±zdan bilgilerinizi gÃ¼ncelleyin.");
            }
            localStorage.removeItem("pending_profile");
          }
          if (newDevice) {
            toast.info("Yeni bir cihazdan giriÅŸ yaptÄ±nÄ±z. 2FA etkinleÅŸtirmenizi Ã¶neriyoruz.", { duration: 8000 });
          } else {
            toast.success("Tekrar hoÅŸgeldiniz!");
          }
          navigate("/");
        } catch (loginErr: any) {
          await recordLoginAttempt(email, false);
          await logSecurityEvent("login_failed", { email, device: getDeviceInfo() });
          throw loginErr;
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Kimlik doÄŸrulama baÅŸarÄ±sÄ±z");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setDetectedUniversityId(null);
    setEmailError("");
    setRequestResultMsg("");
    setRequestSubmitted(false);
    setRequestedUniversityName("");
    setRequestNote("");
    setShowProgramRequestDialog(false);
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
              <CardTitle className="font-heading text-xl font-extrabold">E-postanÄ±zÄ± DoÄŸrulayÄ±n</CardTitle>
              <CardDescription className="text-sm mt-2">
                <span className="font-semibold text-foreground">{signupEmail}</span> adresine bir doÄŸrulama baÄŸlantÄ±sÄ± gÃ¶nderdik.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                   <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <p className="font-semibold text-warning-foreground">Ãœniversite e-postasÄ± kullanÄ±yorsanÄ±z:</p>
                    <ul className="mt-1 space-y-0.5 text-warning-foreground">
                      <li>â€¢ <strong>Spam/Gereksiz</strong> klasÃ¶rÃ¼nÃ¼zÃ¼ mutlaka kontrol edin</li>
                      <li>â€¢ E-posta gelmesi birkaÃ§ dakika sÃ¼rebilir</li>
                      <li>â€¢ Ãœniversitenizin e-posta sistemi gecikmelere yol aÃ§abilir</li>
                    </ul>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <p>E-postayÄ± bulamÄ±yorsanÄ±z aÅŸaÄŸÄ±daki butona tÄ±klayarak tekrar gÃ¶nderebilirsiniz.</p>
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
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> GÃ¶nderiliyor...</span>
                ) : resendCooldown > 0 ? (
                  `Tekrar gÃ¶nder (${resendCooldown}s)`
                ) : (
                  "DoÄŸrulama E-postasÄ±nÄ± Tekrar GÃ¶nder"
                )}
              </Button>

              <Button
                onClick={() => { setSignupComplete(false); setIsSignUp(false); }}
                className="w-full h-10 rounded-lg font-semibold text-sm"
              >
                GiriÅŸ SayfasÄ±na DÃ¶n
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
  const isHardEmailRejection = emailError.startsWith("Sadece TÃ¼rkiye ve KKTC");
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
              {isSignUp ? "Hesap OluÅŸtur" : "Tekrar HoÅŸgeldiniz"}
            </CardTitle>
            <CardDescription className="text-sm mt-1">
              {isSignUp ? "Ãœniversite e-postanÄ±zla gÃ¼venli kayÄ±t olun" : "HesabÄ±nÄ±za gÃ¼venli giriÅŸ yapÄ±n"}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* â”€â”€ FIRST NAME & LAST NAME (signup only) â”€â”€ */}
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
                        placeholder="AdÄ±nÄ±z"
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
                        placeholder="SoyadÄ±nÄ±z"
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

              {/* â”€â”€ USERNAME (signup only) â”€â”€ */}
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
                      KullanÄ±cÄ± AdÄ± <span className="text-destructive">*</span>
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
                      <p className="text-[10px] text-destructive">Bu kullanÄ±cÄ± adÄ± zaten kullanÄ±lÄ±yor.</p>
                    )}
                    {usernameStatus === "inappropriate" && (
                      <p className="text-[10px] text-destructive">Bu kullanÄ±cÄ± adÄ± uygunsuz iÃ§erik barÄ±ndÄ±rÄ±yor. LÃ¼tfen farklÄ± bir ad seÃ§in.</p>
                    )}
                    {usernameStatus === "available" && (
                      <p className="text-[10px] text-success">KullanÄ±cÄ± adÄ± mÃ¼sait âœ“</p>
                    )}
                    {errors.username && <p className="text-[10px] text-destructive">{errors.username}</p>}
                    <p className="text-[10px] text-muted-foreground">Sadece harf, rakam ve alt Ã§izgi. 30 gÃ¼nde bir deÄŸiÅŸtirilebilir.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* â”€â”€ EMAIL â”€â”€ */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {isSignUp ? "Ãœniversite E-postasÄ±" : "E-posta"} <span className="text-destructive">*</span>
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
                      Ãœniversite e-posta adresinizi kullanÄ±n (Ã¶rn: isim@ege.edu.tr)
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
                      <p className="text-[10px] font-semibold text-success">âœ“ Ãœniversite algÄ±landÄ±: {detectedUniversity}</p>
                      <p className="text-[9px] text-success/80">E-posta domain eÅŸleÅŸmesi ile Ã¼niversiteniz otomatik baÄŸlanacaktÄ±r.</p>
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
                        Bu e-posta domaini henÃ¼z sistemde kayÄ±tlÄ± deÄŸil. Kayda devam etmeden Ã¶nce talep oluÅŸturmalÄ±sÄ±nÄ±z.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bu e-posta hangi Ã¼niversiteye ait?</Label>
                      <Input
                        value={requestedUniversityName}
                        onChange={(e) => setRequestedUniversityName(e.target.value)}
                        placeholder="Ã–rn: YakÄ±n DoÄŸu Ãœniversitesi"
                        className="h-9 text-sm"
                        maxLength={200}
                        disabled={requestSending || requestSubmitted}
                      />
                      <Label className="text-xs font-semibold">Not (opsiyonel)</Label>
                      <Input
                        value={requestNote}
                        onChange={(e) => setRequestNote(e.target.value)}
                        placeholder="Ã–rn: Domain neu.edu.tr"
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
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" />GÃ¶nderiliyor</>
                          ) : (
                            "Talep OluÅŸtur"
                          )}
                        </Button>
                      </div>
                      <p className="text-[9px] text-muted-foreground">Admin onayÄ± olmadan bu domain ile signup tamamlanamaz.</p>
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

              {/* â”€â”€ PASSWORD â”€â”€ */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                  Åifre <span className="text-destructive">*</span>
                </Label>
                <PasswordInput id="password" value={password} onChange={setPassword} />
                {isSignUp && <PasswordStrengthIndicator password={password} />}
                {errors.password && <p className="text-[10px] text-destructive">{errors.password}</p>}
              </div>

              {/* â”€â”€ CONFIRM PASSWORD (signup) â”€â”€ */}
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
                      Åifreyi Onayla <span className="text-destructive">*</span>
                    </Label>
                    <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} />
                    {passwordsMatch && (
                      <p className="text-[10px] text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Åifreler eÅŸleÅŸiyor
                      </p>
                    )}
                    {passwordsMismatch && (
                      <p className="text-[10px] text-destructive flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Åifreler eÅŸleÅŸmiyor
                      </p>
                    )}
                    {errors.confirmPassword && <p className="text-[10px] text-destructive">{errors.confirmPassword}</p>}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* â”€â”€ FORGOT PASSWORD (login) â”€â”€ */}
              {!isSignUp && (
                <div className="text-right -mt-1">
                  <Link to="/forgot-password" className="text-[11px] text-primary font-semibold hover:underline">
                    Åifremi unuttum
                  </Link>
                </div>
              )}

              {/* â”€â”€ ACADEMIC INFO (signup, after detection) â”€â”€ */}
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
                      <Label className="text-xs font-semibold">Ãœniversite <span className="text-destructive">*</span></Label>
                      <div className="flex items-center gap-2 h-10 px-3 rounded-lg bg-secondary/50 border border-input">
                        <GraduationCap className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium truncate">{university}</span>
                        <Lock className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                      </div>
                      <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        E-postadan otomatik algÄ±landÄ±. Admin onayÄ± ile deÄŸiÅŸtirilebilir.
                      </p>
                      {errors.university && <p className="text-[10px] text-destructive">{errors.university}</p>}
                    </div>

                    {/* Department */}
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">BÃ¶lÃ¼m <span className="text-destructive">*</span></Label>
                      <SearchableSelect
                        value={department}
                        onValueChange={handleDepartmentChange}
                        placeholder="BÃ¶lÃ¼m seÃ§in"
                        searchPlaceholder="BÃ¶lÃ¼m ara..."
                        options={departmentOptions}
                        error={errors.department}
                      />
                      <button
                        type="button"
                        onClick={() => setShowProgramRequestDialog(true)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 text-primary text-[11px] font-semibold hover:bg-primary/10 hover:border-primary/50 transition-all"
                      >
                        BÃ¶lÃ¼mÃ¼mÃ¼ BulamadÄ±m
                      </button>

                      <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        BÃ¶lÃ¼m talepleri AI yerine admin onaylÄ± request kuyruÄŸuna gÃ¶nderilir.
                      </p>
                    </div>

                    {/* Year + Bio row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">SÄ±nÄ±f</Label>
                        <Select value={classYear} onValueChange={setClassYear}>
                          <SelectTrigger className="h-9 text-sm rounded-lg">
                            <SelectValue placeholder="SeÃ§in" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">HazÄ±rlÄ±k</SelectItem>
                            {Array.from({ length: programYears }, (_, i) => (
                              <SelectItem key={i + 1} value={String(i + 1)}>
                                {i + 1}. SÄ±nÄ±f
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">HakkÄ±mda</Label>
                        <Input
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="KÄ±sa aÃ§Ä±klama"
                          maxLength={100}
                          className="h-9 text-sm rounded-lg"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AcademicProgramRequestDialog
                open={showProgramRequestDialog}
                onOpenChange={setShowProgramRequestDialog}
                context="signup"
                defaultUniversityId={detectedUniversityId}
                defaultUniversityName={detectedUniversity}
                requesterEmail={email}
                onSubmitted={() => {
                  setShowProgramRequestDialog(false);
                }}
              />

              {/* Warning for invalid domain */}
              {isSignUp && !detectedUniversity && !shouldShowUnknownDomainRequest && email && emailDomain && emailError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <Mail className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-[10px] text-warning-foreground">
                    KayÄ±t olmak iÃ§in geÃ§erli bir Ã¼niversite e-posta adresi gereklidir.
                    E-postanÄ±zÄ±n <strong>@universite.edu.tr</strong> formatÄ±nda olduÄŸundan emin olun.
                  </p>
                </div>
              )}

              {/* â”€â”€ TERMS (signup) â”€â”€ */}
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
                      <button type="button" onClick={() => setShowTerms(true)} className="text-primary font-semibold hover:underline">KullanÄ±m KoÅŸullarÄ±</button> ve{" "}
                      <button type="button" onClick={() => setShowPrivacy(true)} className="text-primary font-semibold hover:underline">Gizlilik PolitikasÄ±</button>'nÄ±
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
                    <Loader2 className="h-4 w-4 animate-spin" /> YÃ¼kleniyor...
                  </span>
                ) : isSignUp ? (
                  "KayÄ±t Ol"
                ) : (
                  "GiriÅŸ Yap"
                )}
              </Button>

              {/* Security info banner (signup) */}
              {isSignUp && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-[10px] text-muted-foreground space-y-0.5">
                    <p className="font-semibold text-foreground">GÃ¼venlik Bilgisi</p>
                    <p>â€¢ E-postanÄ±za doÄŸrulama kodu gÃ¶nderilecektir</p>
                    <p>â€¢ Ãœniversite ve bÃ¶lÃ¼m bilgileriniz kayÄ±t sonrasÄ± admin onayÄ± ile deÄŸiÅŸtirilebilir</p>
                    <p>â€¢ Sadece kendi Ã¼niversitenizin derslerine iÃ§erik ekleyebilirsiniz</p>
                  </div>
                </div>
              )}
            </form>

            {/* Toggle signup/login */}
            <div className="mt-5 text-center text-sm text-muted-foreground">
              {isSignUp ? "Zaten hesabÄ±nÄ±z var mÄ±?" : "HesabÄ±nÄ±z yok mu?"}{" "}
              <button onClick={switchMode} className="text-primary font-semibold hover:underline">
                {isSignUp ? "GiriÅŸ Yap" : "KayÄ±t Ol"}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Footer text */}
        <p className="text-center text-[10px] text-muted-foreground mt-4 px-4">
          Verileriniz ÅŸifrelenerek gÃ¼venli sunucularda saklanÄ±r. Åifreniz bcrypt ile hash'lenir.
        </p>
      </motion.div>

      {/* Terms of Service Modal */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 font-heading text-lg">
              <FileText className="h-5 w-5 text-primary" />
              KullanÄ±m KoÅŸullarÄ±
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[65vh]">
            <div className="space-y-4 text-sm text-muted-foreground">
              <p className="text-[10px]">Son gÃ¼ncelleme: 8 Mart 2026</p>
              <h3 className="text-foreground font-semibold text-base">1. Hizmet TanÄ±mÄ±</h3>
              <p>Bu platform, TÃ¼rkiye'deki Ã¼niversite Ã¶ÄŸrencilerinin ders notlarÄ±nÄ±, sÄ±nav sorularÄ±nÄ± ve akademik kaynaklarÄ± paylaÅŸmalarÄ± iÃ§in tasarlanmÄ±ÅŸ bir akademik iÅŸbirliÄŸi platformudur. Platform, yalnÄ±zca geÃ§erli bir Ã¼niversite e-posta adresi (.edu.tr) ile kayÄ±t olan kullanÄ±cÄ±lara hizmet vermektedir.</p>
              <h3 className="text-foreground font-semibold text-base">2. KullanÄ±cÄ± HesabÄ± ve Sorumluluklar</h3>
              <p>KullanÄ±cÄ±lar, kayÄ±t sÄ±rasÄ±nda saÄŸladÄ±klarÄ± bilgilerin doÄŸruluÄŸundan sorumludur. Her kullanÄ±cÄ± yalnÄ±zca bir hesap aÃ§abilir. Hesap bilgileri (Ã¼niversite, bÃ¶lÃ¼m) kayÄ±t sonrasÄ± admin onayÄ± ile deÄŸiÅŸtirilebilir. KullanÄ±cÄ±lar, hesap gÃ¼venliÄŸinden ve ÅŸifrelerinin gizliliÄŸinden kendileri sorumludur.</p>
              <h3 className="text-foreground font-semibold text-base">3. Ä°Ã§erik PolitikasÄ±</h3>
              <p>KullanÄ±cÄ±lar yalnÄ±zca kendi Ã¼niversitelerine ait bÃ¶lÃ¼mlere iÃ§erik ekleyebilir. PaylaÅŸÄ±lan tÃ¼m iÃ§erikler telif hakkÄ± yasalarÄ±na uygun olmalÄ±dÄ±r. Platform, uygunsuz iÃ§erikleri Ã¶nceden haber vermeksizin kaldÄ±rma hakkÄ±nÄ± saklÄ± tutar.</p>
              <h3 className="text-foreground font-semibold text-base">4. Fikri MÃ¼lkiyet</h3>
              <p>KullanÄ±cÄ±lar paylaÅŸtÄ±klarÄ± iÃ§eriklerin fikri mÃ¼lkiyet haklarÄ±na sahip olmalÄ± veya paylaÅŸÄ±m izni almÄ±ÅŸ olmalÄ±dÄ±r. Platformda paylaÅŸÄ±lan iÃ§erikler, iÃ§erik sahibinin mÃ¼lkiyetinde kalÄ±r.</p>
              <h3 className="text-foreground font-semibold text-base">5. Yasaklanan DavranÄ±ÅŸlar</h3>
              <p>Platformda spam, hakaret, taciz, nefret sÃ¶ylemi ve diÄŸer zararlÄ± davranÄ±ÅŸlar kesinlikle yasaktÄ±r. BaÅŸka kullanÄ±cÄ±larÄ±n hesaplarÄ±na yetkisiz eriÅŸim giriÅŸimleri ve otomatik veri toplama (scraping) yasaktÄ±r.</p>
              <h3 className="text-foreground font-semibold text-base">6. Hesap AskÄ±ya Alma</h3>
              <p>Platform, kullanÄ±m koÅŸullarÄ±nÄ± ihlal eden hesaplarÄ± geÃ§ici veya kalÄ±cÄ± olarak askÄ±ya alma hakkÄ±nÄ± saklÄ± tutar.</p>
              <h3 className="text-foreground font-semibold text-base">7. Sorumluluk SÄ±nÄ±rlamasÄ±</h3>
              <p>Platform, kullanÄ±cÄ±lar tarafÄ±ndan paylaÅŸÄ±lan iÃ§eriklerin doÄŸruluÄŸu veya kalitesi konusunda garanti vermez. Platform, hizmet kesintileri veya veri kayÄ±plarÄ±ndan kaynaklanan zararlardan sorumlu tutulamaz.</p>
              <h3 className="text-foreground font-semibold text-base">8. DeÄŸiÅŸiklikler</h3>
              <p>Bu koÅŸullar Ã¶nceden haber verilerek gÃ¼ncellenebilir. Platformu kullanmaya devam etmek, gÃ¼ncellenmiÅŸ koÅŸullarÄ± kabul ettiÄŸiniz anlamÄ±na gelir.</p>
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
              Gizlilik PolitikasÄ±
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[65vh]">
            <div className="space-y-4 text-sm text-muted-foreground">
              <p className="text-[10px]">Son gÃ¼ncelleme: 8 Mart 2026</p>
              <h3 className="text-foreground font-semibold text-base">1. Toplanan Veriler</h3>
              <p>KayÄ±t sÄ±rasÄ±nda: e-posta adresi, kullanÄ±cÄ± adÄ±, Ã¼niversite, bÃ¶lÃ¼m ve sÄ±nÄ±f bilgileri toplanÄ±r. KullanÄ±m sÄ±rasÄ±nda: IP adresi, tarayÄ±cÄ± bilgisi, oturum verileri ve platform iÃ§i aktiviteler kaydedilir.</p>
              <h3 className="text-foreground font-semibold text-base">2. Verilerin KullanÄ±m AmacÄ±</h3>
              <p>Toplanan veriler hesap doÄŸrulama, Ã¼niversiteye Ã¶zgÃ¼ iÃ§erik eriÅŸim kontrolÃ¼, platform gÃ¼venliÄŸinin saÄŸlanmasÄ± ve hizmet kalitesinin iyileÅŸtirilmesi amacÄ±yla kullanÄ±lÄ±r.</p>
              <h3 className="text-foreground font-semibold text-base">3. Veri GÃ¼venliÄŸi</h3>
              <p>Åifreler endÃ¼stri standardÄ± bcrypt algoritmasÄ± ile hash'lenir. TÃ¼m iletiÅŸimler TLS/HTTPS ile korunur. VeritabanÄ± eriÅŸimi Row-Level Security politikalarÄ± ile sÄ±nÄ±rlandÄ±rÄ±lmÄ±ÅŸtÄ±r.</p>
              <h3 className="text-foreground font-semibold text-base">4. Veri PaylaÅŸÄ±mÄ±</h3>
              <p>KiÅŸisel verileriniz Ã¼Ã§Ã¼ncÃ¼ taraflarla paylaÅŸÄ±lmaz. Yasal zorunluluk durumlarÄ± hariÃ§, veriler yalnÄ±zca platform hizmetleri iÃ§in kullanÄ±lÄ±r.</p>
              <h3 className="text-foreground font-semibold text-base">5. KullanÄ±cÄ± HaklarÄ± (KVKK)</h3>
              <p>6698 sayÄ±lÄ± KVKK kapsamÄ±nda: kiÅŸisel verilerinizin iÅŸlenip iÅŸlenmediÄŸini Ã¶ÄŸrenme, dÃ¼zeltilmesini veya silinmesini talep etme, aktarÄ±ldÄ±ÄŸÄ± Ã¼Ã§Ã¼ncÃ¼ kiÅŸileri bilme ve itiraz etme haklarÄ±na sahipsiniz.</p>
              <h3 className="text-foreground font-semibold text-base">6. Ã‡erezler</h3>
              <p>Platform, oturum yÃ¶netimi iÃ§in gerekli Ã§erezler kullanÄ±r. HTTP-only ve SameSite korumalarÄ±yla gÃ¼vence altÄ±na alÄ±nmÄ±ÅŸtÄ±r. ÃœÃ§Ã¼ncÃ¼ taraf izleme Ã§erezleri kullanÄ±lmamaktadÄ±r.</p>
              <h3 className="text-foreground font-semibold text-base">7. Veri Saklama SÃ¼resi</h3>
              <p>Hesap verileri aktif olduÄŸu sÃ¼rece, gÃ¼venlik loglarÄ± 90 gÃ¼n saklanÄ±r. Hesap silinmesinde kiÅŸisel veriler 30 gÃ¼n iÃ§inde kalÄ±cÄ± olarak silinir.</p>
              <h3 className="text-foreground font-semibold text-base">8. Ä°letiÅŸim</h3>
              <p>Gizlilik ile ilgili sorularÄ±nÄ±z iÃ§in platform Ã¼zerinden destek ekibimize ulaÅŸabilirsiniz.</p>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}


