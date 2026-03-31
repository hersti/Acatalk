import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ModerationDecision = {
  safe: boolean;
  violation_type: string;
  severity: "none" | "low" | "medium" | "high" | "critical";
  reason: string;
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/\u0131/g, "i")
    .replace(/\u00fc/g, "u")
    .replace(/\u00f6/g, "o")
    .replace(/\u015f/g, "s")
    .replace(/\u00e7/g, "c")
    .replace(/\u011f/g, "g")
    .replace(/[._\-*#@!$%^&(){}[\]|\\/<>~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RULES: Array<{
  violation: string;
  severity: ModerationDecision["severity"];
  reason: string;
  patterns: RegExp[];
}> = [
  {
    violation: "self_harm",
    severity: "critical",
    reason: "Kendine zarar verme veya intihar tesviki tespit edildi.",
    patterns: [/intihar\s*et/i, /kendini\s*(oldur|kes|as)/i, /ol\s*git\s*ol/i],
  },
  {
    violation: "threat",
    severity: "high",
    reason: "Tehdit icerigi tespit edildi.",
    patterns: [/seni\s*(oldur|bicakla|vurur|keser)/i, /kafani\s*(kesar|kopar|kirim)/i, /oldururum/i],
  },
  {
    violation: "hate_speech",
    severity: "high",
    reason: "Nefret soylemi tespit edildi.",
    patterns: [/hepiniz\s*(pislik|parazit)/i, /(irkci|homofobik|serefsiz\s*millet)/i, /nefret\s*ediyorum\s*hepinizden/i],
  },
  {
    violation: "grooming",
    severity: "critical",
    reason: "Riskli cinsel yonlendirme ifadesi tespit edildi.",
    patterns: [/yasini\s*soyle\s*ozelden/i, /ailene\s*soyleme/i, /ozelden\s*foto\s*gonder/i],
  },
  {
    violation: "sexual",
    severity: "high",
    reason: "Cinsel icerik tespit edildi.",
    patterns: [/nude\s*(at|gonder)/i, /ifsa\s*(at|gonder|izle)/i, /sikis/i, /porn[o]?/i],
  },
  {
    violation: "doxxing",
    severity: "high",
    reason: "Kisisel bilgi ifsasi tespit edildi.",
    patterns: [/tc\s*kimlik/i, /adresini\s*paylas/i, /telefon\s*numarasi\s*paylas/i],
  },
  {
    violation: "dangerous",
    severity: "high",
    reason: "Tehlikeli veya yasa disi eylem tesviki tespit edildi.",
    patterns: [/bomba\s*yapimi/i, /hack\s*araci/i, /uyusturucu\s*satis/i],
  },
  {
    violation: "spam",
    severity: "medium",
    reason: "Spam veya dolandiricilik kalibi tespit edildi.",
    patterns: [/hemen\s*zengin\s*ol/i, /bedava\s*coin/i, /linke\s*tikla\s*kazan/i],
  },
  {
    violation: "harassment",
    severity: "medium",
    reason: "Taciz veya hedefli saldiri dili tespit edildi.",
    patterns: [/sen\s*bir\s*(aptal|salak|gerizekali|mal)/i, /seni\s*rezil\s*ederim/i],
  },
  {
    violation: "profanity",
    severity: "medium",
    reason: "Agir kufur veya hakaret tespit edildi.",
    patterns: [/\bamk\b/i, /\baq\b/i, /siktir/i, /orospu/i, /yarrak/i, /pic\b/i],
  },
];

function evaluateText(text: string): ModerationDecision {
  const normalized = normalizeText(text);
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        safe: false,
        violation_type: rule.violation,
        severity: rule.severity,
        reason: rule.reason,
      };
    }
  }

  return {
    safe: true,
    violation_type: "none",
    severity: "none",
    reason: "",
  };
}

function moderationPoints(violationType: string, severity: ModerationDecision["severity"]) {
  const base: Record<string, number> = {
    profanity: 1,
    harassment: 2,
    spam: 1,
    dangerous: 3,
    doxxing: 3,
    sexual: 3,
    threat: 3,
    hate_speech: 3,
    self_harm: 4,
    grooming: 4,
  };
  const raw = base[violationType] ?? 1;
  if (severity === "critical") return raw + 1;
  if (severity === "low") return 0;
  return raw;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      const {
        data: { user },
      } = await supabaseAuth.auth.getUser();
      userId = user?.id || null;
    } catch {
      userId = null;
    }

    const body = await req.json();
    const text = String(body?.text || "");
    const contentType = String(body?.content_type || "message");
    const contentId = String(body?.content_id || "unknown");

    if (!text.trim()) {
      return new Response(JSON.stringify({ safe: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const decision = evaluateText(text);

    if (!decision.safe && userId) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const blocked = ["medium", "high", "critical"].includes(decision.severity);
      await supabaseAdmin.from("moderation_queue").insert({
        content_type: contentType,
        content_id: contentId,
        content_text: text.substring(0, 2000),
        user_id: userId,
        violation_type: decision.violation_type,
        severity: decision.severity,
        status: blocked ? "blocked" : "flagged",
        ai_confidence: null,
      });

      const points = moderationPoints(decision.violation_type, decision.severity);
      if (points > 0) {
        await supabaseAdmin.rpc("increment_moderation_score", {
          p_user_id: userId,
          p_points: points,
          p_reason: decision.reason || decision.violation_type,
        });
      }
    }

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Moderation error:", error);
    return new Response(JSON.stringify({ safe: true, error: "moderation_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
