import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-pro";

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
  city?: string | null;
  university_type?: string | null;
  program_years?: number;
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
    .replace(/ı/g, "i").replace(/İ/g, "i").replace(/i̇/g, "i")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/â/g, "a")
    .replace(/î/g, "i").replace(/û/g, "u");
}

function normalizeDomainForEdge(domain: string): string {
  const punycodeMap: Record<string, string> = {
    "xn--it-yka": "itu", "xn--gm-yka": "gmu", "xn--bm-yka": "bmu",
  };
  return domain.split(".").map(part => punycodeMap[part] || part).join(".")
    .replace(/ü/g, "u").replace(/ö/g, "o").replace(/ş/g, "s")
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i");
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
  const letters = (s.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length;
  if (letters / Math.max(1, s.length) < 0.35) return true;
  return false;
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
const COURSE_AUTO_APPROVE_THRESHOLD = 0.9;
const REJECT_THRESHOLD = 0.55;
const MAX_CLASS_YEAR = 6;

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const AI_GATEWAY_KEY = Deno.env.get("LOVABLE_API_KEY");
    const LOVABLE_API_KEY = AI_GATEWAY_KEY;

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

      if (looksLikeGarbage(university)) {
        return new Response(
          JSON.stringify({ valid: false, status: "rejected", reason: "Üniversite adı doğrulanamadı (geçersiz format)." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: existingUnis } = await supabaseAdmin.from("departments").select("university").limit(1000);
      const uniqueUnis = [...new Set((existingUnis || []).map((d: any) => d.university).filter(Boolean))];
      const normalizedNew = normalizeForCompare(university);
      
      const duplicate = uniqueUnis.find((u: string) => {
        const norm = normalizeForCompare(u);
        if (norm === normalizedNew) return true;
        const minLen = Math.min(norm.length, normalizedNew.length);
        const maxDist = minLen >= 20 ? 3 : minLen >= 12 ? 2 : 1;
        return levenshteinDistance(norm, normalizedNew) <= maxDist;
      });

      if (duplicate) {
        return new Response(
          JSON.stringify({ valid: false, status: "duplicate", reason: `Bu üniversite zaten mevcut: "${duplicate}".`, existing_name: duplicate }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (emailDomain) {
        const domainMatch = domainMatchesUniversity(emailDomain, university);
        if (domainMatch === false) {
          if (userId) {
            await supabaseAdmin.from("academic_suggestions").insert({
              user_id: userId, type: "university", university,
              status: "rejected", ai_confidence: 0,
              ai_reason: `E-posta alanı (${emailDomain}) üniversiteyle eşleşmiyor.`,
            });
          }
          return new Response(
            JSON.stringify({ valid: false, status: "rejected", reason: `E-posta adresiniz (${emailDomain}) bildirdiğiniz üniversiteyle eşleşmiyor.` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const domainBase = emailDomain ? extractDomainBase(emailDomain) : "";
      const uniPrompt = `Bir kullanıcı Türkiye'de bir üniversite adı bildiriyor: "${university}"
${emailDomain ? `Kullanıcının E-posta Alanı: ${emailDomain} (kök: ${domainBase})` : ""}

Bu üniversitenin Türkiye'de GERÇEKTEN var olup olmadığını doğrula. YÖK tarafından tanınan bir kurum mu?
${emailDomain ? `E-posta alanı bu üniversiteye ait mi kontrol et. Eşleşmiyorsa domain_mismatch=true döndür.` : ""}`;

      const aiResponse = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL, temperature: 0.0, max_tokens: 450,
          messages: [
            {
              role: "system",
              content: `Sen Türk üniversite doğrulama sistemisin. Sadece JSON döndür:
{"valid":true/false,"confidence":0.0-1.0,"normalized_name":"...","city":"...","university_type":"devlet"|"vakıf","reason":"...","domain_mismatch":true/false,"expected_domain":"..."}
Sadece YÖK onaylı gerçek Türk üniversitelerini onayla. Emin değilsen confidence düşük ver.`,
            },
            { role: "user", content: uniPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (userId) {
          await supabaseAdmin.from("academic_suggestions").insert({
            user_id: userId, type: "university", university, status: "pending",
            ai_confidence: null, ai_reason: "AI servisi kullanılamadı",
          });
        }
        return new Response(
          JSON.stringify({ valid: false, status: "pending_review", reason: "Doğrulama servisi meşgul. Öneriniz incelemeye gönderildi." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await aiResponse.json();
      const rawContent = aiData.choices?.[0]?.message?.content || "{}";
      let result: AiResult;
      try {
        result = JSON.parse(extractJsonFromResponse(rawContent));
      } catch {
        result = { valid: false, confidence: 0, reason: "AI yanıtı ayrıştırılamadı", needs_review: true };
      }

      const confidence = typeof result.confidence === "number" ? result.confidence : 0;
      const normalizedName = normalizeLoose(result.normalized_name || university);
      
      if (emailDomain && (result as any).domain_mismatch === true) {
        if (userId) {
          await supabaseAdmin.from("academic_suggestions").insert({
            user_id: userId, type: "university", university,
            status: "rejected", ai_confidence: confidence,
            ai_reason: `E-posta alanı eşleşmiyor.`,
          });
        }
        return new Response(
          JSON.stringify({ valid: false, status: "rejected", reason: `E-posta adresiniz bildirdiğiniz üniversiteyle eşleşmiyor.` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (emailDomain && result.valid && (result as any).expected_domain) {
        const expectedBase = extractDomainBase((result as any).expected_domain);
        const actualBase = extractDomainBase(emailDomain);
        if (expectedBase && actualBase && expectedBase !== actualBase) {
          if (userId) {
            await supabaseAdmin.from("academic_suggestions").insert({
              user_id: userId, type: "university", university,
              status: "rejected", ai_confidence: confidence,
              ai_reason: `Çapraz kontrol başarısız: beklenen=${expectedBase}, gerçek=${actualBase}`,
            });
          }
          return new Response(
            JSON.stringify({ valid: false, status: "rejected", reason: `E-posta adresiniz bildirdiğiniz üniversiteyle eşleşmiyor.` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (result.valid && confidence >= AUTO_APPROVE_THRESHOLD) {
        await supabaseAdmin.from("universities").upsert({
          name: normalizedName, city: result.city || null, type: result.university_type || null, created_by: userId,
        }, { onConflict: "name" });

        const { data: existingDept } = await supabaseAdmin.from("departments").select("id").eq("university", normalizedName).limit(1);
        if (!existingDept || existingDept.length === 0) {
          await supabaseAdmin.from("departments").insert({
            university: normalizedName, name: "Genel", program_years: 4, created_by: userId,
          });
        }

        if (userId) {
          await supabaseAdmin.from("academic_suggestions").insert({
            user_id: userId, type: "university", university: normalizedName,
            status: "approved", ai_confidence: confidence, ai_reason: result.reason || null, normalized_name: normalizedName,
          });
        }
        return new Response(
          JSON.stringify({ valid: true, status: "approved", normalized_name: normalizedName, city: result.city, university_type: result.university_type, reason: result.reason || "Üniversite doğrulandı." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Not approved - reject or send to review
      if (userId) {
        await supabaseAdmin.from("academic_suggestions").insert({
          user_id: userId, type: "university", university,
          status: confidence >= REJECT_THRESHOLD ? "pending" : "rejected",
          ai_confidence: confidence, ai_reason: result.reason || null, normalized_name: normalizedName,
        });
      }

      if (confidence >= REJECT_THRESHOLD) {
        return new Response(
          JSON.stringify({ valid: false, status: "pending_review", reason: result.reason || "Öneriniz incelemeye gönderildi." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ valid: false, status: "rejected", reason: result.reason || "Bu üniversite doğrulanamadı." }),
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
      if (looksLikeGarbage(department)) {
        return new Response(
          JSON.stringify({ valid: false, status: "rejected", reason: "Bölüm adı doğrulanamadı (geçersiz format)." }),
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
          JSON.stringify({ valid: false, status: "rejected", reason: "Ders adı doğrulanamadı (geçersiz format)." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const classYearProvided = class_year !== null && class_year !== "";
      requestedClassYear = parseClassYear(class_year);
      if (classYearProvided && requestedClassYear === null) {
        return new Response(JSON.stringify({ error: "Invalid class_year. 0-6 aralığında olmalı." }), {
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
            reason: `Seçtiğiniz sınıf (${requestedClassYear}) bu bölüm için geçerli değil. Bu bölümde 0-${departmentProgramYearsForCourse} arası seçebilirsiniz.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (isOverlyGenericCourseName(course_name) && !course_code && !explanation) {
        return new Response(
          JSON.stringify({
            valid: false,
            status: "rejected",
            reason: "Ders adı çok genel görünüyor. Lütfen daha spesifik bir ad (örn. Almanca I / Almanca Dilbilgisi) veya ders kodu girin.",
            suggestion: "Ders kodu veya dönem bilgisi ekleyin.",
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
          JSON.stringify({ valid: false, status: "duplicate", reason: `Bu bölüm zaten mevcut: "${duplicate}".`, existing_name: duplicate }),
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

    // AI service unavailable -> deterministic fallback (no hard 500)
    if (!AI_GATEWAY_KEY) {
      if (type === "department") {
        const normalizedName = normalizeLoose(department || "");
        if (!normalizedName || looksLikeGarbage(normalizedName)) {
          return new Response(
            JSON.stringify({ valid: false, status: "rejected", reason: "Bölüm adı doğrulanamadı (geçersiz format)." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (userId) {
          await supabaseAdmin.from("academic_suggestions").insert({
            user_id: userId,
            type: "department",
            university,
            department: normalizedName,
            faculty,
            status: "pending_review",
            ai_confidence: null,
            ai_reason: "AI doğrulama servisi kullanılamıyor; manuel incelemeye alındı.",
            normalized_name: normalizedName,
          });
          return new Response(
            JSON.stringify({
              valid: false,
              status: "pending_review",
              normalized_name: normalizedName,
              reason: "Doğrulama servisi geçici olarak kullanılamıyor. Öneriniz admin incelemesine gönderildi.",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            valid: true,
            status: "approved",
            normalized_name: normalizedName,
            reason: "Doğrulama servisi geçici olarak kullanılamıyor. Bölümünüz kaydedildi.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
          status: "pending_review",
          ai_confidence: null,
          ai_reason: "AI doğrulama servisi kullanılamıyor; manuel incelemeye alındı.",
          normalized_name: normalizeLoose(course_name!),
        });
        return new Response(
          JSON.stringify({
            valid: false,
            status: "pending_review",
            reason: "Doğrulama servisi geçici olarak kullanılamıyor. Öneriniz admin incelemesine gönderildi.",
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
      ? `"${university}" üniversitesinde "${department}" bölümünün var olup olmadığını doğrula.
${faculty ? `Fakülte: ${faculty}` : ""}
${explanation ? `Açıklama: ${explanation}` : ""}

Mevcut bölümler: ${existingDeptNames.length ? existingDeptNames.join(" | ") : "(yok)"}

ARAŞTIRMA TALİMATI:
- Bu üniversitenin resmi web sitesini düşün
- YÖK Atlas verilerini düşün
- Bu spesifik üniversitede bu bölüm gerçekten var mı?
- Türkiye'de genel olarak var olması YETERLİ DEĞİL, bu üniversitede olmalı
- Küçük vakıf üniversitelerinde Tıp, Hukuk, Eczacılık genellikle YOKTUR
- program_years: Tıp=6, Eczacılık/Diş/Veteriner/Mimarlık=5, MYO/Ön Lisans=2, diğer=4`
      : `"${university}" - "${department}" bölümünde "${course_name}" dersinin var olup olmadığını doğrula.
${course_code ? `Kullanıcının girdiği Ders Kodu: ${course_code}` : "Kullanıcı ders kodu girmedi."}
${class_year ? `Kullanıcının seçtiği sınıf: ${class_year} (sadece referans, sınıf kararını resmi müfredata göre ver)` : ""}
${explanation ? `Açıklama: ${explanation}` : ""}
Bu bölümün azami sınıf süresi: ${departmentProgramYearsForCourse} (0=hazırlık, 1-${departmentProgramYearsForCourse}=sınıf)

Mevcut dersler: ${existingCourseSample.length ? existingCourseSample.join(" | ") : "(yok)"}

KRİTİK SINIF DÜZEYİ TALİMATI:
1. Bu üniversitenin resmi müfredatını/ders planını araştır. "${university}" "${department}" müfredatında bu ders kaçıncı yarıyılda/yılda veriliyor?
2. Ders kodunu araştır. Kullanıcı kod girmemişse bile sen üniversitenin resmi ders kodunu bul ve "discovered_code" alanında bildir.
3. Ders kodu numara sistemi: İlk rakam genelde sınıf düzeyini gösterir. Örn: BIL201/CSE201 → 2.sınıf, MAT301 → 3.sınıf, FIZ102 → 1.sınıf
4. Yarıyıl → Sınıf dönüşümü: 1-2. yarıyıl = 1.sınıf, 3-4. yarıyıl = 2.sınıf, 5-6. yarıyıl = 3.sınıf, 7-8. yarıyıl = 4.sınıf
5. Hazırlık (year=0) SADECE yabancı dil hazırlık dersleri içindir, başka hiçbir ders hazırlık olamaz.
6. "Genellikle", "muhtemelen", "büyük ihtimalle" gibi ifadeler KULLANMA. Kesin bilgi ver veya bulamadığını söyle.

DİL KURALI:
- normalized_name MUTLAKA TÜRKÇE olmalı. "Calculus" → "Kalkülüs", "Data Structures" → "Veri Yapıları", "Linear Algebra" → "Lineer Cebir" vb.
- TEK İSTİSNA: Yabancı dil ve edebiyat bölümleri için o dildeki isimler kabul edilir.`;

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_GATEWAY_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, temperature: 0.0, max_tokens: 4000,
        messages: [
          {
            role: "system",
            content: `Sen bir Türk üniversite akademik veri doğrulama sistemisin. Türkiye'deki üniversitelerin resmi müfredatlarını araştırarak karar veriyorsun.

GÖREVİN: Bölüm veya dersin GERÇEK olup olmadığını araştır ve KARAR VER.
- Doğruysa → otomatik olarak veritabanına eklenecek
- Yanlışsa → reddedilecek

Sadece JSON döndür:
{
  "valid": true/false,
  "confidence": 0.0-1.0,
  "normalized_name": "Türkçe ders/bölüm adı",
  "description": "kısa açıklama" veya null,
  "recommended_year": 0-6,
  "discovered_code": "üniversitenin resmi ders kodu" veya null,
  "reason": "kararın gerekçesi - hangi kaynaktan/müfredattan doğruladığını açıkla",
  "suggestion": null,
  "program_years": 4
}

SINIF DÜZEYİ BELİRLEME - EN KRİTİK GÖREV:
- recommended_year alanı ZORUNLU ve DOĞRU OLMALI.
- Üniversitenin resmi müfredatını, ders planını, Bologna bilgi paketini araştır.
- Dersin hangi yarıyılda verildiğini bul ve yıla çevir (1-2.yarıyıl→1, 3-4.yarıyıl→2, 5-6.yarıyıl→3, 7-8.yarıyıl→4).
- Ders kodundaki ilk rakam genelde sınıf düzeyini gösterir (1xx=1.sınıf, 2xx=2.sınıf, 3xx=3.sınıf, 4xx=4.sınıf).
- Kullanıcının seçtiği sınıf YANLIŞ olabilir. Kullanıcıya güvenme, kendi araştırmanı yap.
- "Genellikle X. sınıfta okutulur" gibi belirsiz ifadeler YASAK. Spesifik müfredat bilgisi ver.
- discovered_code: Kullanıcı kod girmemiş olsa bile, üniversitenin bu ders için kullandığı resmi kodu bul ve bildir.
- Hazırlık (0) SADECE yabancı dil hazırlık sınıfı dersleri için geçerlidir.

DİL KURALI:
- normalized_name MUTLAKA TÜRKÇE OLMALI.
  Örnekler: "Calculus"→"Kalkülüs", "Calculus 2"→"Kalkülüs II", "Data Structures"→"Veri Yapıları", "Linear Algebra"→"Lineer Cebir", "Physics"→"Fizik", "Differential Equations"→"Diferansiyel Denklemler"
  TEK İSTİSNA: Yabancı dil/edebiyat bölümleri için o dildeki isimler kabul edilir.

KARAR KRİTERLERİ:
- Bölüm için confidence >= 0.82: ONAYLANIR
- Ders için confidence >= 0.90: ONAYLANIR
- Altı: REDDEDİLİR
- Saçma/spam → confidence=0
- Sınıf düzeyini belirleyemiyorsan → valid=false, reason'da açıkla`,
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI Gateway error:", aiResponse.status);
      // AI failed - reject rather than queue
      return new Response(
        JSON.stringify({ valid: false, status: "rejected", reason: "Doğrulama servisi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";
    console.log("AI raw response:", rawContent.substring(0, 500));

    let result: AiResult;
    try {
      const cleaned = extractJsonFromResponse(rawContent);
      console.log("AI cleaned JSON:", cleaned.substring(0, 500));
      result = JSON.parse(cleaned);
      console.log("AI result:", JSON.stringify(result));
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "cleaned:", extractJsonFromResponse(rawContent).substring(0, 300));
      result = { valid: false, confidence: 0, reason: "AI yanıtı ayrıştırılamadı" };
    }

    const confidence = typeof result.confidence === "number" ? result.confidence : 0;
    const normalizedName = normalizeLoose(result.normalized_name || (type === "department" ? department! : course_name!));
    const requiredApprovalThreshold = type === "course" ? COURSE_AUTO_APPROVE_THRESHOLD : AUTO_APPROVE_THRESHOLD;

    // ===== AUTO-INSERT IF APPROVED =====
    if (result.valid && confidence >= requiredApprovalThreshold) {
      if (type === "department") {
        const programYears = sanitizeProgramYears(result.program_years, normalizedName);
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("departments")
          .insert({
            university,
            name: normalizedName,
            faculty: faculty || null,
            program_years: programYears,
            created_by: userId,
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Department insert error:", insertError);
          return new Response(
            JSON.stringify({ valid: false, status: "error", reason: "Bölüm eklenirken bir hata oluştu." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (userId) {
          await supabaseAdmin.from("academic_suggestions").insert({
            user_id: userId, type: "department", university, department: normalizedName, faculty,
            status: "approved", ai_confidence: confidence, ai_reason: result.reason || null,
            normalized_name: normalizedName, inserted_id: inserted?.id || null,
          });
        }

        return new Response(
          JSON.stringify({
            valid: true, status: "approved", normalized_name: normalizedName,
            department_id: inserted?.id, reason: result.reason || "Bölüm doğrulandı ve eklendi!",
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
        // NOTE: user input is never used as final year to prevent yanlış sınıf manipülasyonu.
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
              reason: "Dersin sınıf düzeyi güvenilir şekilde belirlenemedi. Lütfen ders kodu (örn. BIL201) ile tekrar deneyin.",
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
            JSON.stringify({ valid: false, status: "error", reason: "Ders eklenirken bir hata oluştu." }),
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
            reason: result.reason || "Ders doğrulandı ve eklendi!",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ===== REJECTED =====
    if (userId) {
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
        reason: result.reason || "Bu bilgi doğrulanamadı. Lütfen doğru bilgileri girdiğinizden emin olun.",
        suggestion: result.suggestion || null,
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
