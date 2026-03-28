import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const IMAGE_MODERATION_TOOL = {
  type: "function" as const,
  function: {
    name: "report_image_moderation_result",
    description: "Report the image safety moderation analysis result.",
    parameters: {
      type: "object",
      properties: {
        safe: {
          type: "boolean",
          description: "Whether the image is safe and does not violate any policies.",
        },
        violation_type: {
          type: "string",
          enum: ["none", "nsfw", "nudity", "sexual", "violence", "hate", "drugs", "disturbing"],
          description: "The type of violation detected, or 'none' if safe.",
        },
        severity: {
          type: "string",
          enum: ["none", "low", "medium", "high", "critical"],
          description: "The severity level of the violation.",
        },
        confidence: {
          type: "number",
          description: "Confidence score between 0.0 and 1.0.",
        },
        reason: {
          type: "string",
          description: "Brief explanation in Turkish.",
        },
      },
      required: ["safe", "violation_type", "severity", "confidence", "reason"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are an advanced, strict image safety moderation system for ACATALK, a Turkish university student platform. You must catch ALL inappropriate visual content. Be thorough and err on the side of caution for ANY serious violation.

## DETECTION CATEGORIES — BE EXTREMELY THOROUGH:

**NSFW / PORNOGRAPHY** (violation_type: "nsfw") — BLOCK ALWAYS
- Pornographic content of any kind (real, animated, AI-generated, drawn)
- Explicit sexual acts, simulations, or depictions
- Genital exposure (real or illustrated)
- Sexual imagery, even partially obscured, censored, or pixelated
- Hentai, doujinshi, erotic manga/anime
- Screenshots from pornographic videos or websites
- QR codes or links to pornographic content visible in images

**NUDITY** (violation_type: "nudity") — BLOCK
- Full or partial nudity (real or illustrated)
- Exposed breasts, buttocks, genitalia
- Underwear/lingerie photos that are clearly sexual in nature
- Near-nude poses designed to be sexual or provocative
- "Barely covered" content that is clearly intended to be sexual
- Sheer/transparent clothing revealing intimate areas
- Note: artistic/medical/educational nudity in clearly academic context may pass at low severity

**SEXUAL CONTENT** (violation_type: "sexual") — BLOCK
- Sexualized poses, suggestive imagery
- Sexual innuendo in memes, edits, or text overlays
- Fetish content, BDSM imagery (even clothed)
- Inappropriately sexualized characters (anime, cartoon, etc.)
- Deepfakes or face-swapped sexual content
- "Thirst traps" with clearly sexual intent
- Sexual product imagery

**VIOLENCE** (violation_type: "violence") — BLOCK
- Gore, graphic violence, mutilation, blood
- Real or realistic depictions of serious injury
- Weapons pointed at people or in threatening context
- Torture, abuse imagery
- War atrocity images, execution imagery
- Animal cruelty, animal abuse
- Self-harm depictions (cutting, etc.)
- Accident/injury gore

**HATE / EXTREMISM** (violation_type: "hate") — BLOCK
- Hate symbols (swastikas, white supremacist symbols, SS, etc.)
- Extremist propaganda imagery, ISIS/terrorist flags
- Racist/discriminatory imagery or memes
- Antisemitic, Islamophobic, or other religious hate imagery
- Memes mocking genocide, ethnic cleansing, or mass violence
- Grey Wolves salute in threatening/extremist context

**DRUGS** (violation_type: "drugs") — BLOCK
- Drug use, drug paraphernalia
- Drug promotion/glorification
- Substance abuse imagery
- Drug dealing advertisements
- Cannabis/marijuana glamorization in promotional context

**DISTURBING** (violation_type: "disturbing") — BLOCK
- Shocking or disturbing content designed to distress
- Jump scare content, body horror
- Extremely disturbing memes
- Images designed to trigger phobias
- Dead bodies (human or animal)
- Severe medical conditions shown for shock value

**CHILD SAFETY** (violation_type: "nsfw", severity: "critical") — CRITICAL BLOCK
- ANY sexualized content involving minors — real or illustrated
- Lolicon, shotacon content
- Age-inappropriate content involving children
- This is the HIGHEST priority — never miss this

## SEVERITY LEVELS:
- "low": borderline, may be acceptable in academic context
- "medium": clearly problematic — block
- "high": seriously inappropriate — block immediately
- "critical": extreme violation (child safety, extreme gore, terrorism) — block and escalate

## IMPORTANT RULES:
1. Regular photos, memes, educational content, screenshots, documents are SAFE
2. Profile pictures (content_type: "avatar") should be held to a HIGHER standard
3. Catch AI-generated NSFW content — deepfakes, Stable Diffusion NSFW, etc.
4. Consider context: anatomy diagrams in academic settings are OK
5. Screenshots of social media showing NSFW content should be flagged
6. Text in images: check for profanity, hate speech, threats in Turkish and English
7. Watermarks from porn sites visible in images = flag as nsfw
8. When unsure between safe/unsafe for medium+ severity items, flag it
9. Memes with NSFW undertones or sexual innuendo should be flagged
10. Check for hidden content: steganography-style hiding of NSFW in seemingly normal images

Use the report_image_moderation_result tool to return your analysis.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id || null;
    }

    const { image_url, content_type, content_id } = await req.json();
    if (!image_url) {
      return new Response(JSON.stringify({ safe: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: `Analyze this image for safety violations. Be strict and thorough. Content type: ${content_type || "image"}` },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
        tools: [IMAGE_MODERATION_TOOL],
        tool_choice: { type: "function", function: { name: "report_image_moderation_result" } },
        temperature: 0.05,
        max_tokens: 400,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ safe: true, error: "rate_limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ safe: true, error: "payment_required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ safe: true, error: "moderation_unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();

    // Extract result from tool call (structured output)
    let result: { safe: boolean; violation_type: string; severity: string; confidence: number; reason: string };

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        result = parseFallbackContent(aiData);
      }
    } else {
      result = parseFallbackContent(aiData);
    }

    if (!result.safe && userId) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const severity = result.severity || "high";

      await supabaseAdmin.from("moderation_queue").insert({
        content_type: content_type || "image",
        content_id: content_id || "unknown",
        content_url: image_url,
        user_id: userId,
        violation_type: result.violation_type || "nsfw",
        severity: severity,
        status: "blocked",
        ai_confidence: result.confidence || 0.8,
      });

      const scoreMap: Record<string, number> = {
        nsfw: 5,
        nudity: 4,
        sexual: 4,
        violence: 3,
        hate: 4,
        drugs: 2,
        disturbing: 3,
      };
      const points = scoreMap[result.violation_type] || 3;
      const finalPoints = severity === "critical" ? points * 2 : points;
      
      await supabaseAdmin.rpc("increment_moderation_score", {
        p_user_id: userId,
        p_points: finalPoints,
        p_reason: result.reason || "Uygunsuz görsel yükleme girişimi",
      });
    }

    return new Response(JSON.stringify({
      safe: result.safe,
      violation_type: result.violation_type,
      severity: result.severity,
      reason: result.reason,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Image moderation error:", error);
    return new Response(JSON.stringify({ safe: true, error: "moderation_error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Fallback parser for when tool calling is not used */
function parseFallbackContent(aiData: any) {
  const rawContent = aiData.choices?.[0]?.message?.content || "";
  try {
    const jsonStr = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr);
  } catch {
    return { safe: true, violation_type: "none", severity: "none", confidence: 0, reason: "" };
  }
}
