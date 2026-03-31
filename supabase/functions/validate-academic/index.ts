import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type SuggestionType = "department" | "course" | "university";

type AiResult = {
  valid: boolean;
  confidence: number;
  normalized_name?: string;
  description?: string;
  recommended_year?: number;
  discovered_code?: string;
  reason?: string;
  needs_review?: boolean;
  suggestion?: string | null;
  validation_provider?: string;
  city?: string | null;
  university_type?: string | null;
  program_years?: number;
  recommended_year?: number | null;
  discovered_code?: string | null;
};

function extractJsonFromResponse(raw: string): string {
  let s = String(raw);
  s = s.replace(/<think>[\s\S]*?<\/think>/g, "");
  s = s.replace(/```json\n?/g, "").replace(/```\n?/g, "");
  s = s.trim();
  if (!s.startsWith("{")) {
    const jsonStart = s.indexOf("{");
    if (jsonStart !== -1) s = s.substring(jsonStart);
  }
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace !== -1) s = s.substring(0, lastBrace + 1);
  return s;
}

function normalizeLoose(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function normalizeCourseCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeLoose(value).replace(/\s+/g, "").toUpperCase().slice(0, 20);
  return normalized || null;
}

function normalizeForCompare(input: string): string {
  return turkishToAscii(normalizeLoose(input).toLowerCase());
}

function turkishToAscii(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ç/g, "c").replace(/ğ/g, "g")
    .replace(/Ä±/g, "i").replace(/Ä°/g, "i").replace(/iÌ‡/g, "i")
    .replace(/Ã¶/g, "o").replace(/Ã¼/g, "u").replace(/ÅŸ/g, "s")
    .replace(/Ã§/g, "c").replace(/ÄŸ/g, "g").replace(/Ã¢/g, "a")
    .replace(/Ã®/g, "i").replace(/Ã»/g, "u");
}

function normalizeDomainForEdge(domain: string): string {
  const punycodeMap: Record<string, string> = {
    "xn--it-yka": "itu", "xn--gm-yka": "gmu", "xn--bm-yka": "bmu",
  };
  return domain.split(".").map(part => punycodeMap[part] || part).join(".")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ş/g, "s")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/Ã¼/g, "u").replace(/Ã¶/g, "o").replace(/ÅŸ/g, "s")
    .replace(/Ã§/g, "c").replace(/ÄŸ/g, "g").replace(/Ä±/g, "i");
}

function extractDomainBase(emailDomain: string): string {
  const normalized = normalizeDomainForEdge(emailDomain);
  let cleaned = normalized.replace(/\.edu\.tr$/, "").replace(/\.edu$/, "");
  const parts = cleaned.split(".");
  return parts[parts.length - 1] || "";
}

function domainMatchesUniversity(emailDomain: string, universityName: string): boolean | null {
  if (!emailDomain) return null;
  const domainBase = turkishToAscii(extractDomainBase(emailDomain));
  if (!domainBase || domainBase.length < 2) return null;
  const uniNormalized = turkishToAscii(universityName);
  const stopWords = ["universitesi", "universite", "teknik", "sosyal", "bilimler", "bilim", "teknoloji", "ve", "dis", "yuksek"];
  const uniWords = uniNormalized.replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length >= 2 && !stopWords.includes(w));
  for (const word of uniWords) {
    if (word.includes(domainBase) || domainBase.includes(word)) return true;
  }
  const allUniWords = uniNormalized.replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length >= 1);
  if (allUniWords.length >= 2) {
    const firstLetters = allUniWords.map(w => w[0]).join("");
    if (firstLetters.length >= 2) {
      if (domainBase === firstLetters || firstLetters.startsWith(domainBase) || domainBase.startsWith(firstLetters)) return true;
    }
    const combo2 = allUniWords[0].substring(0, 2) + allUniWords.slice(1).map(w => w[0]).join("");
    if (domainBase === combo2) return true;
  }
  if (domainBase.length >= 6) {
    const uniFlat = uniNormalized.replace(/[^a-z]/g, "");
    if (!uniFlat.includes(domainBase) && !domainBase.includes(uniFlat.substring(0, Math.min(uniFlat.length, 8)))) return false;
  }
  return null;
}

function looksLikeGarbage(input: string): boolean {
  const s = input.trim();
  if (s.length < 3) return true;
  if (s.length > 200) return true;
  if (/https?:\/\//i.test(s)) return true;
  if (/(.)\1{6,}/.test(s)) return true;
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (letters / Math.max(1, s.length) < 0.35) return true;
  return false;
}

const BLOCKED_DEPARTMENT_TERMS = new Set([
  "sex", "seks", "porno", "porn", "xxx", "fuck", "sikis", "sik", "yarak",
  "amcik", "penis", "vajina", "vagina", "pussy", "dick",
]);

function containsBlockedDepartmentTerm(input: string): boolean {
  const normalized = normalizeForCompare(input).replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.some((t) => BLOCKED_DEPARTMENT_TERMS.has(t));
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

// Thresholds
const AUTO_APPROVE_THRESHOLD = 0.82;
const DEPARTMENT_AUTO_APPROVE_THRESHOLD = 0.9;
const COURSE_AUTO_APPROVE_THRESHOLD = 0.9;
const REJECT_THRESHOLD = 0.55;
const MAX_CLASS_YEAR = 6;

type DepartmentDecisionOverride = {
  status: "approved" | "rejected";
  reason: string;
  normalizedName?: string;
};

const DEPARTMENT_DECISION_OVERRIDES: Record<string, DepartmentDecisionOverride> = {
  "girne amerikan universitesi::pilotaj": {
    status: "approved",
    reason: "Bu kombinasyon manuel olarak dogrulanmis bir istisna olarak onaylandi.",
    normalizedName: "Pilotaj",
  },
  "ege universitesi::endustri muhendisligi": {
    status: "rejected",
    reason: "Bu kombinasyon manuel olarak dogrulanmis bir istisna olarak reddedildi.",
  },
};

function normalizeDepartmentOverrideKeyPart(input: string): string {
  return turkishToAscii(normalizeLoose(input).toLowerCase())
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\u0130/g, "i")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDepartmentDecisionOverride(
  universityName: string,
  departmentName: string
): DepartmentDecisionOverride | null {
  const key = `${normalizeDepartmentOverrideKeyPart(universityName)}::${normalizeDepartmentOverrideKeyPart(departmentName)}`;
  return DEPARTMENT_DECISION_OVERRIDES[key] || null;
}

const GENERIC_ONE_WORD_COURSES = new Set([
  "almanca",
  "ingilizce",
  "fransizca",
  "ispanyolca",
  "arapca",
  "rusca",
  "turkce",
  "matematik",
  "fizik",
  "kimya",
  "biyoloji",
]);

function inferProgramYearsFromDepartment(departmentName: string): number {
  const normalized = normalizeForCompare(departmentName);

  if (normalized.includes("tip")) return 6;
  if (["eczac", "dis hekim", "veteriner", "mimarlik"].some((keyword) => normalized.includes(keyword))) return 5;
  if (
    normalized.includes("onlisans") ||
    normalized.includes("on lisans") ||
    normalized.includes("meslek yuksekokulu") ||
    normalized.includes("myo")
  ) {
    return 2;
  }

  return 4;
}

function sanitizeProgramYears(value: unknown, fallbackDepartment: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(6, Math.max(2, Math.trunc(value)));
  }

  return inferProgramYearsFromDepartment(fallbackDepartment);
}

function parseClassYear(value: string | null): number | null {
  if (value === null || value === "") return null;

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_CLASS_YEAR) return null;

  return parsed;
}

function inferYearFromCourseCode(courseCode: string | null): number | null {
  if (!courseCode) return null;

  const normalized = courseCode.toUpperCase().replace(/\s+/g, "");
  const numericPart = normalized.match(/(\d{3,4})/);
  if (!numericPart) return null;

  const firstDigit = Number.parseInt(numericPart[1][0], 10);
  if (!Number.isFinite(firstDigit) || firstDigit < 1 || firstDigit > MAX_CLASS_YEAR) return null;

  return firstDigit;
}

const ROMAN_YEAR_MAP: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
};

function inferYearFromCourseName(courseName: string): number | null {
  const normalized = normalizeLoose(courseName || "");
  if (!normalized) return null;

  const romanMatches = normalized.toUpperCase().match(/\b(VI|V|IV|III|II|I)\b/g);
  if (romanMatches?.length) {
    const lastRoman = romanMatches[romanMatches.length - 1];
    return ROMAN_YEAR_MAP[lastRoman] ?? null;
  }

  const standaloneDigitMatches = normalized.match(/(?:^|[\s(])([1-6])(?:[\s).\-]|$)/g);
  if (standaloneDigitMatches?.length) {
    const lastMatch = standaloneDigitMatches[standaloneDigitMatches.length - 1];
    const digit = lastMatch.match(/([1-6])/);
    if (digit) return Number.parseInt(digit[1], 10);
  }

  return null;
}

function inferCanonicalYear(departmentName: string, courseName: string): number | null {
  const dep = normalizeForCompare(departmentName);
  const course = normalizeForCompare(courseName);

  if (
    dep.includes("bilgisayar muhendisligi") &&
    (course.includes("bilgisayar mimarisi") ||
      course.includes("computer architecture") ||
      course.includes("bilgisayar organizasyonu"))
  ) {
    return 2;
  }

  return null;
}

function hasUncertainYearReason(reason: string | null | undefined): boolean {
  if (!reason) return true;

  const normalized = normalizeForCompare(reason);
  const uncertainSignals = [
    "genellikle",
    "muhtemelen",
    "olasi",
    "cogunlukla",
    "tahminen",
    "olabilir",
    "muhtemel",
    "buyuk ihtimal",
    "buyuk olasilik",
    "yaklasik",
  ];

  return uncertainSignals.some((signal) => normalized.includes(signal));
}

function isOverlyGenericCourseName(courseName: string): boolean {
  const normalized = normalizeForCompare(courseName);
  if (!normalized || normalized.includes(" ")) return false;

  return GENERIC_ONE_WORD_COURSES.has(normalized);
}

async function callAnthropicJson(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("timeout"), args.timeoutMs ?? 12000);
  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": args.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: args.model,
        max_tokens: 2000,
        temperature: 0,
        system: args.systemPrompt,
        messages: [{ role: "user", content: args.userPrompt }],
      }),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("ANTHROPIC_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ANTHROPIC_HTTP_${response.status}:${text.slice(0, 400)}`);
  }

  const payload = await response.json();
  const rawContent = ((payload.content || []) as any[])
    .filter((part) => part?.type === "text")
    .map((part) => String(part.text || ""))
    .join("\n");

  const cleaned = extractJsonFromResponse(rawContent || "{}");
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("ANTHROPIC_PARSE_ERROR");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "UNKNOWN_ERROR");
  if (message.includes("ANTHROPIC_HTTP_")) {
    return message.split(":")[0];
  }
  if (message.includes("ANTHROPIC_TIMEOUT")) return "ANTHROPIC_TIMEOUT";
  if (message.includes("ANTHROPIC_PARSE_ERROR")) return "ANTHROPIC_PARSE_ERROR";
  if (message.includes("INVALID_AI_RESULT_SCHEMA")) return "INVALID_AI_RESULT_SCHEMA";
  if (message.includes("RETRY_EXHAUSTED")) {
    return message.split(":")[1] || "RETRY_EXHAUSTED";
  }
  return "UNKNOWN_ERROR";
}

function validateAiResultShape(result: unknown, type: SuggestionType): AiResult | null {
  if (!result || typeof result !== "object") return null;
  const obj = result as Record<string, unknown>;
  if (typeof obj.valid !== "boolean") return null;
  if (typeof obj.confidence !== "number" || !Number.isFinite(obj.confidence)) return null;
  if (type === "department") {
    if (typeof obj.reason !== "string" || !obj.reason.trim()) return null;
    if (typeof obj.normalized_name !== "string" || !obj.normalized_name.trim()) return null;
  }
  return result as AiResult;
}

async function callAnthropicJsonWithRetry(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  type: SuggestionType;
}) {
  const retryDelaysMs = [0, 400, 1200, 2500];
  let lastErrorCode: string | null = null;

  for (let i = 0; i < retryDelaysMs.length; i++) {
    if (retryDelaysMs[i] > 0) {
      await sleep(retryDelaysMs[i]);
    }

    try {
      const raw = await callAnthropicJson({
        apiKey: args.apiKey,
        model: args.model,
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        timeoutMs: 12000,
      });

      const validated = validateAiResultShape(raw, args.type);
      if (!validated) {
        throw new Error("INVALID_AI_RESULT_SCHEMA");
      }

      return {
        result: validated,
        attemptCount: i + 1,
        lastErrorCode,
      };
    } catch (error) {
      lastErrorCode = toErrorCode(error);
      console.error(`Anthropic attempt ${i + 1} failed:`, lastErrorCode, error);
    }
  }

  throw new Error(`RETRY_EXHAUSTED:${lastErrorCode || "UNKNOWN_ERROR"}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-sonnet-20241022";

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let userId: string | null = null;
    try {
      const { data: { user } } = await supabaseAuth.auth.getUser();
      userId = user?.id || null;
    } catch { userId = null; }

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const type = body?.type as SuggestionType;
    if (!userId && type === "course") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const universityRaw = body?.university as string | undefined;
    const facultyRaw = body?.faculty as string | null | undefined;
    const departmentRaw = body?.department as string | null | undefined;
    const courseNameRaw = body?.course_name as string | null | undefined;
    const courseCodeRaw = body?.course_code as string | null | undefined;
    const classYearRaw = body?.class_year as string | null | undefined;
    const explanationRaw = body?.explanation as string | null | undefined;
    const emailDomainRaw = body?.email_domain as string | null | undefined;
    const emailDomain = emailDomainRaw ? normalizeDomainForEdge(emailDomainRaw.trim().toLowerCase()) : null;

    if (!type || !["department", "course", "university"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!universityRaw || !normalizeLoose(universityRaw)) {
      return new Response(JSON.stringify({ error: "University required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const university = normalizeLoose(universityRaw);
    const faculty = facultyRaw ? normalizeLoose(facultyRaw) : null;
    const department = departmentRaw ? normalizeLoose(departmentRaw) : null;
    const course_name = courseNameRaw ? normalizeLoose(courseNameRaw) : null;
    const explanation = explanationRaw ? normalizeLoose(explanationRaw) : null;
    const course_code = normalizeCourseCode(courseCodeRaw || null);
    const class_year = classYearRaw ? normalizeLoose(classYearRaw) : null;

    let departmentProgramYearsForCourse = 4;
    let requestedClassYear: number | null = null;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

        // ===== UNIVERSITY TYPE =====
    if (type === "university") {
      return new Response(
        JSON.stringify({
          valid: false,
          status: "rejected",
          reason: "Universite oneri akisi kapatildi. Signup yalnizca kayitli domain eslesmesiyle ilerler.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== DEPARTMENT & COURSE VALIDATION =====
    if (type === "department") {
      if (!department) {
        return new Response(JSON.stringify({ error: "Department name required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const normalizedUniversityKey = normalizeDepartmentOverrideKeyPart(university);
      const normalizedDepartmentKey = normalizeDepartmentOverrideKeyPart(department);
      const normalizedEmailDomainKey = (emailDomain || "").toLowerCase();
      const foldedUniversityKey = turkishToAscii(university).replace(/[^a-z]/g, "");
      const foldedDepartmentKey = turkishToAscii(department).replace(/[^a-z]/g, "");
      if (
        (normalizedEmailDomainKey === "gau.edu.tr" ||
          normalizedUniversityKey === "girne amerikan universitesi" ||
          foldedUniversityKey.includes("girneamerikanuniversitesi")) &&
        (normalizedDepartmentKey === "pilotaj" || foldedDepartmentKey === "pilotaj")
      ) {
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("departments" as any)
          .upsert(
            {
              university,
              name: "Pilotaj",
              faculty: faculty || null,
              program_years: 4,
              created_by: userId,
            },
            { onConflict: "university,name_normalized" }
          )
          .select("id, name")
          .maybeSingle();

        if (insertError) {
          return new Response(
            JSON.stringify({
              valid: false,
              status: "error",
              reason: "Bolum eklenirken bir hata olustu.",
              validation_provider: "hard_rule",
              attempt_count: 0,
              last_error_code: "DEPARTMENT_INSERT_ERROR",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            valid: true,
            status: "approved",
            normalized_name: "Pilotaj",
            department_id: inserted?.id,
            reason: "Bu kombinasyon manuel olarak dogrulanmis bir istisna olarak onaylandi.",
            validation_provider: "hard_rule",
            attempt_count: 0,
            last_error_code: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (
        (normalizedEmailDomainKey === "ege.edu.tr" ||
          normalizedUniversityKey === "ege universitesi" ||
          foldedUniversityKey.includes("egeuniversitesi")) &&
        (normalizedDepartmentKey === "endustri muhendisligi" ||
          (normalizedDepartmentKey.includes("endustri") && normalizedDepartmentKey.includes("muhendis")) ||
          foldedDepartmentKey.includes("endustrimuhendisligi"))
      ) {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "rejected",
            reason: "Bu kombinasyon manuel olarak dogrulanmis bir istisna olarak reddedildi.",
            validation_provider: "hard_rule",
            attempt_count: 0,
            last_error_code: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (looksLikeGarbage(department)) {
        return new Response(
          JSON.stringify({ valid: false, status: "rejected", reason: "BÃ¶lÃ¼m adÄ± doÄŸrulanamadÄ± (geÃ§ersiz format)." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (containsBlockedDepartmentTerm(department)) {
        return new Response(
          JSON.stringify({ valid: false, status: "rejected", reason: "Bu bÃ¶lÃ¼m adÄ± uygunsuz veya akademik deÄŸil." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (type === "course") {
      if (!department || !course_name) {
        return new Response(JSON.stringify({ error: "Course name and department required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (looksLikeGarbage(course_name)) {
        return new Response(
          JSON.stringify({ valid: false, status: "rejected", reason: "Ders adÄ± doÄŸrulanamadÄ± (geÃ§ersiz format)." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const classYearProvided = class_year !== null && class_year !== "";
      requestedClassYear = parseClassYear(class_year);
      if (classYearProvided && requestedClassYear === null) {
        return new Response(JSON.stringify({ error: "Invalid class_year. 0-6 aralÄ±ÄŸÄ±nda olmalÄ±." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: departmentRows } = await supabaseAdmin
        .from("departments" as any)
        .select("program_years")
        .eq("university", university)
        .eq("name", department)
        .limit(1);

      departmentProgramYearsForCourse = sanitizeProgramYears(departmentRows?.[0]?.program_years, department);

      if (requestedClassYear !== null && requestedClassYear > departmentProgramYearsForCourse) {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "rejected",
            reason: `SeÃ§tiÄŸiniz sÄ±nÄ±f (${requestedClassYear}) bu bÃ¶lÃ¼m iÃ§in geÃ§erli deÄŸil. Bu bÃ¶lÃ¼mde 0-${departmentProgramYearsForCourse} arasÄ± seÃ§ebilirsiniz.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isOverlyGenericCourseName(course_name) && !course_code && !explanation) {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "rejected",
            reason: "Ders adÄ± Ã§ok genel gÃ¶rÃ¼nÃ¼yor. LÃ¼tfen daha spesifik bir ad (Ã¶rn. Almanca I / Almanca Dilbilgisi) veya ders kodu girin.",
            suggestion: "Ders kodu veya dÃ¶nem bilgisi ekleyin.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (type === "department" && department) {
      const override = getDepartmentDecisionOverride(university, department);
      if (override?.status === "rejected") {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "rejected",
            reason: override.reason,
            validation_provider: "manual_override",
            attempt_count: 0,
            last_error_code: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (override?.status === "approved") {
        const normalizedOverrideName = normalizeLoose(override.normalizedName || department);
        const programYears = sanitizeProgramYears(null, normalizedOverrideName);
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("departments" as any)
          .upsert(
            {
              university,
              name: normalizedOverrideName,
              faculty: faculty || null,
              program_years: programYears,
              created_by: userId,
            },
            { onConflict: "university,name_normalized" }
          )
          .select("id, name")
          .maybeSingle();

        if (insertError) {
          console.error("Department manual override insert error:", insertError);
          return new Response(
            JSON.stringify({
              valid: false,
              status: "error",
              reason: "Bolum eklenirken bir hata olustu.",
              validation_provider: "manual_override",
              attempt_count: 0,
              last_error_code: "DEPARTMENT_INSERT_ERROR",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            valid: true,
            status: "approved",
            normalized_name: normalizedOverrideName,
            department_id: inserted?.id,
            reason: override.reason,
            validation_provider: "manual_override",
            attempt_count: 0,
            last_error_code: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Duplicate checks
    if (type === "department" && department) {
      const normalizedNew = normalizeForCompare(department);
      const [deptTableRes, coursesDeptRes] = await Promise.all([
        supabaseAdmin.from("departments" as any).select("id, name").eq("university", university).limit(1000),
        supabaseAdmin.from("courses").select("department").eq("university", university).limit(1000),
      ]);
      const existingDepts = [...new Set([
        ...((deptTableRes.data as any[]) || []).map((d) => d.name),
        ...((coursesDeptRes.data as any[]) || []).map((c) => c.department),
      ])].filter(Boolean);

      const duplicate = existingDepts.find((d: string) => {
        const normalizedExisting = normalizeForCompare(d);
        if (normalizedExisting === normalizedNew) return true;
        const minLen = Math.min(normalizedExisting.length, normalizedNew.length);
        const maxDist = minLen >= 20 ? 3 : minLen >= 12 ? 2 : 1;
        return levenshteinDistance(normalizedExisting, normalizedNew) <= maxDist;
      });

      if (duplicate) {
        return new Response(
          JSON.stringify({
            valid: true,
            status: "approved",
            reason: `Bu bÃ¶lÃ¼m zaten mevcut: "${duplicate}".`,
            existing_name: duplicate,
            normalized_name: duplicate,
            validation_provider: "database_duplicate",
            attempt_count: 0,
            last_error_code: null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (type === "course" && course_name && department) {
      const normalizedNew = normalizeForCompare(course_name);
      const { data: existing } = await supabaseAdmin.from("courses").select("id, name, code").eq("university", university).eq("department", department).limit(1000);
      const duplicate = (existing || []).find((c: any) => {
        const normalizedExisting = normalizeForCompare(c.name);
        const existingCode = normalizeCourseCode(c.code);
        return (
          normalizedExisting === normalizedNew ||
          levenshteinDistance(normalizedExisting, normalizedNew) <= 2 ||
          (!!course_code && !!existingCode && existingCode === course_code)
        );
      });
      if (duplicate) {
        return new Response(
          JSON.stringify({ valid: false, status: "duplicate", reason: `Bu ders zaten mevcut: "${duplicate.name}"${duplicate.code ? ` (${duplicate.code})` : ""}.`, existing_name: duplicate.name, existing_id: duplicate.id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // AI service unavailable
    if (!ANTHROPIC_API_KEY) {
      if (type === "department") {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "error",
            reason: "DoÄŸrulama servisi ÅŸu an kullanÄ±lamÄ±yor. LÃ¼tfen daha sonra tekrar deneyin.",
            validation_provider: "none",
            attempt_count: 0,
            last_error_code: "MISSING_ANTHROPIC_API_KEY",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (type === "course") {
        await supabaseAdmin.from("academic_suggestions").insert({
          user_id: userId,
          type: "course",
          university,
          department: department!,
          course_name: course_name!,
          course_code: course_code,
          class_year: class_year,
          explanation,
          status: "pending",
          ai_confidence: null,
          ai_reason: "AI doÄŸrulama servisi kullanÄ±lamÄ±yor; manuel incelemeye alÄ±ndÄ±.",
          normalized_name: normalizeLoose(course_name!),
        });
        return new Response(
          JSON.stringify({
            valid: false,
            status: "pending_review",
            reason: "DoÄŸrulama servisi geÃ§ici olarak kullanÄ±lamÄ±yor. Ã–neriniz admin incelemesine gÃ¶nderildi.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Context for AI
    const deptContext = await supabaseAdmin.from("departments" as any).select("name").eq("university", university).order("name", { ascending: true }).limit(200);
    const existingDeptNames: string[] = (((deptContext.data as any[]) || []).map((d) => d.name).filter(Boolean) as string[]).slice(0, 60);

    const courseContext = type === "course" && department
      ? await supabaseAdmin.from("courses").select("name, code, year").eq("university", university).eq("department", department).order("name", { ascending: true }).limit(200)
      : { data: [] as any[] };

    const existingCourseSample = (courseContext.data || []).slice(0, 60).map((c: any) => `${c.code ? `${c.code} - ` : ""}${c.name}${c.year ? ` (${c.year})` : ""}`);

    // AI PROMPT - designed for AUTO-INSERT or REJECT (no admin queue)
    const prompt = type === "department"
      ? `"${university}" Ã¼niversitesinde "${department}" bÃ¶lÃ¼mÃ¼nÃ¼n var olup olmadÄ±ÄŸÄ±nÄ± doÄŸrula.
${faculty ? `FakÃ¼lte: ${faculty}` : ""}
${explanation ? `AÃ§Ä±klama: ${explanation}` : ""}

Mevcut bÃ¶lÃ¼mler: ${existingDeptNames.length ? existingDeptNames.join(" | ") : "(yok)"}

ARAÅTIRMA TALÄ°MATI:
- Bu Ã¼niversitenin resmi web sitesini dÃ¼ÅŸÃ¼n
- YÃ–K Atlas verilerini dÃ¼ÅŸÃ¼n
- Bu spesifik Ã¼niversitede bu bÃ¶lÃ¼m gerÃ§ekten var mÄ±?
- TÃ¼rkiye'de genel olarak var olmasÄ± YETERLÄ° DEÄÄ°L, bu Ã¼niversitede olmalÄ±
- KÃ¼Ã§Ã¼k vakÄ±f Ã¼niversitelerinde TÄ±p, Hukuk, EczacÄ±lÄ±k genellikle YOKTUR
- program_years: TÄ±p=6, EczacÄ±lÄ±k/DiÅŸ/Veteriner/MimarlÄ±k=5, MYO/Ã–n Lisans=2, diÄŸer=4`
      : `"${university}" - "${department}" bÃ¶lÃ¼mÃ¼nde "${course_name}" dersinin var olup olmadÄ±ÄŸÄ±nÄ± doÄŸrula.
${course_code ? `KullanÄ±cÄ±nÄ±n girdiÄŸi Ders Kodu: ${course_code}` : "KullanÄ±cÄ± ders kodu girmedi."}
${class_year ? `KullanÄ±cÄ±nÄ±n seÃ§tiÄŸi sÄ±nÄ±f: ${class_year} (sadece referans, sÄ±nÄ±f kararÄ±nÄ± resmi mÃ¼fredata gÃ¶re ver)` : ""}
${explanation ? `AÃ§Ä±klama: ${explanation}` : ""}
Bu bÃ¶lÃ¼mÃ¼n azami sÄ±nÄ±f sÃ¼resi: ${departmentProgramYearsForCourse} (0=hazÄ±rlÄ±k, 1-${departmentProgramYearsForCourse}=sÄ±nÄ±f)

Mevcut dersler: ${existingCourseSample.length ? existingCourseSample.join(" | ") : "(yok)"}

KRÄ°TÄ°K SINIF DÃœZEYÄ° TALÄ°MATI:
1. Bu Ã¼niversitenin resmi mÃ¼fredatÄ±nÄ±/ders planÄ±nÄ± araÅŸtÄ±r. "${university}" "${department}" mÃ¼fredatÄ±nda bu ders kaÃ§Ä±ncÄ± yarÄ±yÄ±lda/yÄ±lda veriliyor?
2. Ders kodunu araÅŸtÄ±r. KullanÄ±cÄ± kod girmemiÅŸse bile sen Ã¼niversitenin resmi ders kodunu bul ve "discovered_code" alanÄ±nda bildir.
3. Ders kodu numara sistemi: Ä°lk rakam genelde sÄ±nÄ±f dÃ¼zeyini gÃ¶sterir. Ã–rn: BIL201/CSE201 â†’ 2.sÄ±nÄ±f, MAT301 â†’ 3.sÄ±nÄ±f, FIZ102 â†’ 1.sÄ±nÄ±f
4. YarÄ±yÄ±l â†’ SÄ±nÄ±f dÃ¶nÃ¼ÅŸÃ¼mÃ¼: 1-2. yarÄ±yÄ±l = 1.sÄ±nÄ±f, 3-4. yarÄ±yÄ±l = 2.sÄ±nÄ±f, 5-6. yarÄ±yÄ±l = 3.sÄ±nÄ±f, 7-8. yarÄ±yÄ±l = 4.sÄ±nÄ±f
5. HazÄ±rlÄ±k (year=0) SADECE yabancÄ± dil hazÄ±rlÄ±k dersleri iÃ§indir, baÅŸka hiÃ§bir ders hazÄ±rlÄ±k olamaz.
6. "Genellikle", "muhtemelen", "bÃ¼yÃ¼k ihtimalle" gibi ifadeler KULLANMA. Kesin bilgi ver veya bulamadÄ±ÄŸÄ±nÄ± sÃ¶yle.

DÄ°L KURALI:
- normalized_name MUTLAKA TÃœRKÃ‡E olmalÄ±. "Calculus" â†’ "KalkÃ¼lÃ¼s", "Data Structures" â†’ "Veri YapÄ±larÄ±", "Linear Algebra" â†’ "Lineer Cebir" vb.
- TEK Ä°STÄ°SNA: YabancÄ± dil ve edebiyat bÃ¶lÃ¼mleri iÃ§in o dildeki isimler kabul edilir.`;

    const systemPrompt = `Sen bir TÃ¼rk Ã¼niversite akademik veri doÄŸrulama sistemisin. TÃ¼rkiye'deki Ã¼niversitelerin resmi mÃ¼fredatlarÄ±nÄ± araÅŸtÄ±rarak karar veriyorsun.

GÃ–REVÄ°N: BÃ¶lÃ¼m veya dersin GERÃ‡EK olup olmadÄ±ÄŸÄ±nÄ± araÅŸtÄ±r ve KARAR VER.
- DoÄŸruysa â†’ otomatik olarak veritabanÄ±na eklenecek
- YanlÄ±ÅŸsa â†’ reddedilecek

Sadece JSON dÃ¶ndÃ¼r:
{
  "valid": true/false,
  "confidence": 0.0-1.0,
  "normalized_name": "TÃ¼rkÃ§e ders/bÃ¶lÃ¼m adÄ±",
  "description": "kÄ±sa aÃ§Ä±klama" veya null,
  "recommended_year": 0-6,
  "discovered_code": "Ã¼niversitenin resmi ders kodu" veya null,
  "reason": "kararÄ±n gerekÃ§esi - hangi kaynaktan/mÃ¼fredattan doÄŸruladÄ±ÄŸÄ±nÄ± aÃ§Ä±kla",
  "suggestion": null,
  "program_years": 4
}

SINIF DÃœZEYÄ° BELÄ°RLEME - EN KRÄ°TÄ°K GÃ–REV:
- recommended_year alanÄ± ZORUNLU ve DOÄRU OLMALI.
- Ãœniversitenin resmi mÃ¼fredatÄ±nÄ±, ders planÄ±nÄ±, Bologna bilgi paketini araÅŸtÄ±r.
- Dersin hangi yarÄ±yÄ±lda verildiÄŸini bul ve yÄ±la Ã§evir (1-2.yarÄ±yÄ±lâ†’1, 3-4.yarÄ±yÄ±lâ†’2, 5-6.yarÄ±yÄ±lâ†’3, 7-8.yarÄ±yÄ±lâ†’4).
- Ders kodundaki ilk rakam genelde sÄ±nÄ±f dÃ¼zeyini gÃ¶sterir (1xx=1.sÄ±nÄ±f, 2xx=2.sÄ±nÄ±f, 3xx=3.sÄ±nÄ±f, 4xx=4.sÄ±nÄ±f).
- KullanÄ±cÄ±nÄ±n seÃ§tiÄŸi sÄ±nÄ±f YANLIÅ olabilir. KullanÄ±cÄ±ya gÃ¼venme, kendi araÅŸtÄ±rmanÄ± yap.
- "Genellikle X. sÄ±nÄ±fta okutulur" gibi belirsiz ifadeler YASAK. Spesifik mÃ¼fredat bilgisi ver.
- discovered_code: KullanÄ±cÄ± kod girmemiÅŸ olsa bile, Ã¼niversitenin bu ders iÃ§in kullandÄ±ÄŸÄ± resmi kodu bul ve bildir.
- HazÄ±rlÄ±k (0) SADECE yabancÄ± dil hazÄ±rlÄ±k sÄ±nÄ±fÄ± dersleri iÃ§in geÃ§erlidir.

DÄ°L KURALI:
- normalized_name MUTLAKA TÃœRKÃ‡E OLMALI.
  Ã–rnekler: "Calculus"â†’"KalkÃ¼lÃ¼s", "Calculus 2"â†’"KalkÃ¼lÃ¼s II", "Data Structures"â†’"Veri YapÄ±larÄ±", "Linear Algebra"â†’"Lineer Cebir", "Physics"â†’"Fizik", "Differential Equations"â†’"Diferansiyel Denklemler"
  TEK Ä°STÄ°SNA: YabancÄ± dil/edebiyat bÃ¶lÃ¼mleri iÃ§in o dildeki isimler kabul edilir.

KARAR KRÄ°TERLERÄ°:
- BÃ¶lÃ¼m iÃ§in confidence >= 0.82: ONAYLANIR
- Ders iÃ§in confidence >= 0.90: ONAYLANIR
- AltÄ±: REDDEDÄ°LÄ°R
- SaÃ§ma/spam â†’ confidence=0
- SÄ±nÄ±f dÃ¼zeyini belirleyemiyorsan â†’ valid=false, reason'da aÃ§Ä±kla`;

    let result: AiResult;
    let aiProvider: "anthropic_direct" | "none" = "none";
    let attemptCount = 0;
    let lastErrorCode: string | null = null;

    try {
      aiProvider = "anthropic_direct";
      if (type === "department") {
        const retryResult = await callAnthropicJsonWithRetry({
          apiKey: ANTHROPIC_API_KEY!,
          model: ANTHROPIC_MODEL,
          systemPrompt,
          userPrompt: prompt,
          type,
        });
        result = retryResult.result;
        attemptCount = retryResult.attemptCount;
        lastErrorCode = retryResult.lastErrorCode;
      } else {
        result = await callAnthropicJson({
          apiKey: ANTHROPIC_API_KEY!,
          model: ANTHROPIC_MODEL,
          systemPrompt,
          userPrompt: prompt,
        });
        attemptCount = 1;
      }
    } catch (aiErr) {
      const errorCode = toErrorCode(aiErr);
      const effectiveAttempts = type === "department" ? 4 : 1;
      console.error("Anthropic request failed:", errorCode, aiErr);
      return new Response(
        JSON.stringify({
          valid: false,
          status: "error",
          reason: "Dogrulama servisi su an kullanilamiyor. Lutfen daha sonra tekrar deneyin.",
          validation_provider: "none",
          attempt_count: effectiveAttempts,
          last_error_code: errorCode,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }


    const confidence = typeof result.confidence === "number" ? result.confidence : 0;
    const normalizedName = normalizeLoose(result.normalized_name || (type === "department" ? department! : course_name!));
    const requiredApprovalThreshold =
      type === "course"
        ? COURSE_AUTO_APPROVE_THRESHOLD
        : type === "department"
          ? DEPARTMENT_AUTO_APPROVE_THRESHOLD
          : AUTO_APPROVE_THRESHOLD;
    const isDepartmentDecisionCertain =
      type !== "department" || !hasUncertainYearReason(result.reason);

    // ===== AUTO-INSERT IF APPROVED =====
    if (result.valid && confidence >= requiredApprovalThreshold && isDepartmentDecisionCertain) {
      if (type === "department") {
        const programYears = sanitizeProgramYears(result.program_years, normalizedName);
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("departments" as any)
          .upsert(
            {
              university,
              name: normalizedName,
              faculty: faculty || null,
              program_years: programYears,
              created_by: userId,
            },
            { onConflict: "university,name_normalized" }
          )
          .select("id, name")
          .maybeSingle();

        if (insertError) {
          console.error("Department insert error:", insertError);
          return new Response(
            JSON.stringify({
              valid: false,
              status: "error",
              reason: "BÃ¶lÃ¼m eklenirken bir hata oluÅŸtu.",
              validation_provider: aiProvider,
              attempt_count: attemptCount,
              last_error_code: "DEPARTMENT_INSERT_ERROR",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            valid: true, status: "approved", normalized_name: normalizedName,
            department_id: inserted?.id, reason: result.reason || "BÃ¶lÃ¼m doÄŸrulandÄ± ve eklendi!",
            validation_provider: aiProvider,
            attempt_count: attemptCount,
            last_error_code: lastErrorCode,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (type === "course") {
        const aiRecommendedYear = typeof result.recommended_year === "number" && Number.isFinite(result.recommended_year)
          ? Math.trunc(result.recommended_year)
          : null;
        const safeAiYear = aiRecommendedYear !== null && aiRecommendedYear >= 0 && aiRecommendedYear <= MAX_CLASS_YEAR
          ? aiRecommendedYear
          : null;

        // Use discovered_code from AI if user didn't provide one
        const effectiveCode = course_code || (result.discovered_code ? normalizeLoose(result.discovered_code).replace(/\s+/g, "").toUpperCase() : null);

        const codeInferredYear = inferYearFromCourseCode(effectiveCode);
        const titleInferredYear = inferYearFromCourseName(normalizedName) ?? inferYearFromCourseName(course_name || "");
        const canonicalInferredYear = inferCanonicalYear(department!, normalizedName);

        // Priority: code > AI research > canonical > title
        // NOTE: user input is never used as final year to prevent yanlÄ±ÅŸ sÄ±nÄ±f manipÃ¼lasyonu.
        const selectedYear =
          codeInferredYear ??
          safeAiYear ??
          canonicalInferredYear ??
          titleInferredYear;

        if (selectedYear === null || selectedYear === undefined) {
          return new Response(
            JSON.stringify({
              valid: false,
              status: "rejected",
              reason: "Dersin sÄ±nÄ±f dÃ¼zeyi gÃ¼venilir ÅŸekilde belirlenemedi. LÃ¼tfen ders kodu (Ã¶rn. BIL201) ile tekrar deneyin.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const safeYear = Math.min(departmentProgramYearsForCourse, Math.max(0, selectedYear));

        let yearSource = "fallback";
        if (codeInferredYear !== null) yearSource = "course_code";
        else if (safeAiYear !== null) yearSource = "ai_research";
        else if (canonicalInferredYear !== null) yearSource = "canonical_rule";
        else if (titleInferredYear !== null) yearSource = "course_name";

        const discoveredCode = normalizeCourseCode(result.discovered_code || null);
        const finalCode = course_code || discoveredCode;

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("courses")
          .insert({
            university,
            department: department!,
            name: normalizedName,
            code: finalCode,
            year: safeYear,
            description: result.description || null,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Course insert error:", insertError);
          return new Response(
            JSON.stringify({ valid: false, status: "error", reason: "Ders eklenirken bir hata oluÅŸtu." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (userId) {
          await supabaseAdmin.from("academic_suggestions").insert({
            user_id: userId,
            type: "course",
            university,
            department: department!,
            course_name: normalizedName,
            course_code: finalCode,
            class_year: String(safeYear),
            status: "approved",
            ai_confidence: confidence,
            ai_reason: `${result.reason || ""}${result.reason ? " | " : ""}year_source=${yearSource}`,
            normalized_name: normalizedName,
            inserted_id: inserted?.id || null,
          });
        }

        return new Response(
          JSON.stringify({
            valid: true,
            status: "approved",
            normalized_name: normalizedName,
            course_id: inserted?.id,
            year: safeYear,
            year_source: yearSource,
            reason: result.reason || "Ders doÄŸrulandÄ± ve eklendi!",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== REJECTED =====
    if (userId && type !== "department") {
      await supabaseAdmin.from("academic_suggestions").insert({
        user_id: userId, type, university, faculty, department,
        course_name, course_code, class_year, explanation,
        status: "rejected", ai_confidence: confidence, ai_reason: result.reason || null,
        normalized_name: normalizedName,
      });
    }

    return new Response(
      JSON.stringify({
        valid: false, status: "rejected",
        reason: result.reason || "Bu bilgi doÄŸrulanamadÄ±. LÃ¼tfen doÄŸru bilgileri girdiÄŸinizden emin olun.",
        suggestion: result.suggestion || null,
        validation_provider: aiProvider,
        attempt_count: attemptCount,
        last_error_code: lastErrorCode,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Validation error:", error);
    return new Response(JSON.stringify({ error: "Validation failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
