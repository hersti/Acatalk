import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ModerationDecision = {
  safe: boolean;
  violation_type: "none" | "nsfw" | "nudity" | "sexual" | "violence" | "hate" | "drugs" | "disturbing";
  severity: "none" | "low" | "medium" | "high" | "critical";
  reason: string;
};

const URL_RULES: Array<{
  violation: ModerationDecision["violation_type"];
  severity: ModerationDecision["severity"];
  reason: string;
  keywords: string[];
}> = [
  {
    violation: "nsfw",
    severity: "high",
    reason: "Gorsel URL'sinde NSFW anahtar kelimesi tespit edildi.",
    keywords: ["porn", "xxx", "nsfw", "hentai", "onlyfans", "ifsa"],
  },
  {
    violation: "nudity",
    severity: "high",
    reason: "Gorsel URL'sinde nudity anahtar kelimesi tespit edildi.",
    keywords: ["nude", "nudity", "ciplak", "lingerie"],
  },
  {
    violation: "sexual",
    severity: "high",
    reason: "Gorsel URL'sinde cinsel icerik kalibi tespit edildi.",
    keywords: ["sexy", "fetish", "bdsm", "erotic"],
  },
  {
    violation: "violence",
    severity: "high",
    reason: "Gorsel URL'sinde siddet/gore kalibi tespit edildi.",
    keywords: ["gore", "blood", "behead", "corpse", "execution"],
  },
  {
    violation: "hate",
    severity: "high",
    reason: "Gorsel URL'sinde nefret/extremizm kalibi tespit edildi.",
    keywords: ["nazi", "swastika", "kkk", "extremist"],
  },
  {
    violation: "drugs",
    severity: "medium",
    reason: "Gorsel URL'sinde uyusturucu anahtar kelimesi tespit edildi.",
    keywords: ["cocaine", "meth", "drug", "weed", "marijuana"],
  },
  {
    violation: "disturbing",
    severity: "medium",
    reason: "Gorsel URL'sinde rahatsiz edici icerik kalibi tespit edildi.",
    keywords: ["autopsy", "injury", "selfharm", "disturbing"],
  },
];

function evaluateImageUrl(imageUrl: string): ModerationDecision {
  const lowered = imageUrl.toLowerCase();
  for (const rule of URL_RULES) {
    if (rule.keywords.some((keyword) => lowered.includes(keyword))) {
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

function moderationPoints(violationType: ModerationDecision["violation_type"], severity: ModerationDecision["severity"]) {
  const base: Record<ModerationDecision["violation_type"], number> = {
    none: 0,
    nsfw: 5,
    nudity: 4,
    sexual: 4,
    violence: 3,
    hate: 4,
    drugs: 2,
    disturbing: 3,
  };
  const raw = base[violationType] ?? 0;
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
    const imageUrl = String(body?.image_url || "").trim();
    const contentType = String(body?.content_type || "image");
    const contentId = String(body?.content_id || "unknown");

    if (!imageUrl) {
      return new Response(JSON.stringify({ safe: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const parsed = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return new Response(
          JSON.stringify({
            safe: false,
            violation_type: "disturbing",
            severity: "low",
            reason: "Gorsel baglantisi gecersiz bir protokol kullaniyor.",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch {
      return new Response(
        JSON.stringify({
          safe: false,
          violation_type: "disturbing",
          severity: "low",
          reason: "Gorsel baglantisi gecersiz.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const decision = evaluateImageUrl(imageUrl);

    if (!decision.safe && userId) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const blocked = ["medium", "high", "critical"].includes(decision.severity);
      await supabaseAdmin.from("moderation_queue").insert({
        content_type: contentType,
        content_id: contentId,
        content_url: imageUrl,
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
          p_reason: decision.reason || "Uygunsuz gorsel",
        });
      }
    }

    return new Response(JSON.stringify(decision), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Image moderation error:", error);
    return new Response(JSON.stringify({ safe: true, error: "moderation_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
