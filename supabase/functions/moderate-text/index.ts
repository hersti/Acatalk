import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MODERATION_TOOL = {
  type: "function" as const,
  function: {
    name: "report_moderation_result",
    description: "Report the content moderation analysis result.",
    parameters: {
      type: "object",
      properties: {
        safe: {
          type: "boolean",
          description: "Whether the content is safe and does not violate any policies.",
        },
        violation_type: {
          type: "string",
          enum: ["none", "toxic", "harassment", "hate_speech", "threat", "self_harm", "profanity", "sexual", "grooming", "spam", "dangerous", "doxxing"],
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

const SYSTEM_PROMPT = `You are an advanced, strict content moderation system for ACATALK, a Turkish university student platform. You MUST catch ALL harmful, abusive, inappropriate, and policy-violating content while allowing normal academic discussion.

## CRITICAL: TURKISH LANGUAGE EXPERTISE
You are an expert in Turkish language including:
- All Turkish slang, insults, profanity, and coded language
- Common abbreviations: amk, mk, aq, sg, sktr, oç, oc, am*na, s*ktir, a.q, s.g, etc.
- Leetspeak substitutions: sık1ş, s!kt!r, @mına, 0rospu, p1ç, g0t, y@rr@k
- Character substitution: ı→i, ş→s→§, ç→c, ö→o, ü→u, ğ→g
- Spacing/punctuation tricks: "s i k t i r", "a.m.k", "o r o s p u"
- Reversed text, intentional misspelling, mixed alphabets (Cyrillic, Greek)
- Turkish cultural context and regional expressions

## VIOLATION CATEGORIES — BE THOROUGH AND STRICT:

**TOXIC / INSULTS** (violation_type: "toxic")
- Direct insults, personal attacks, name-calling
- Derogatory language targeting individuals
- Aggressive or belittling speech patterns
- Passive-aggressive attacks designed to hurt
- Turkish insults: aptal, gerizekalı, salak, mal, ezik, dangalak, etc.

**HARASSMENT** (violation_type: "harassment")
- Targeted negative behavior toward someone
- Cyberbullying, intimidation, stalking language
- Encouraging others to harass someone
- Doxxing or sharing/requesting personal information (phone, address, TC kimlik)
- Sexual harassment, unwanted sexual advances
- Persistent unwanted contact language

**HATE SPEECH** (violation_type: "hate_speech")
- Discrimination based on race, ethnicity, nationality, religion, gender, sexual orientation, disability
- Slurs, dehumanizing language toward any group
- Extremist ideology promotion
- Nationalist or supremacist rhetoric
- Anti-refugee, anti-minority, anti-LGBTQ+ hate
- Turkish-specific hate: ethnic slurs, sectarian hatred

**THREATS** (violation_type: "threat")
- Direct or implied threats of violence
- Threats of physical harm, property damage, sexual violence
- Intimidation through violent imagery in words
- "Seni öldürürüm", "kafanı keserim" type threats

**SELF-HARM** (violation_type: "self_harm")
- Encouraging or glorifying self-harm or suicide
- Providing methods or instructions for self-harm
- "Kendini öldür", "intihar et" type content
- This is CRITICAL severity — always flag

**PROFANITY** (violation_type: "profanity")
- Excessive and aggressive swearing directed at people
- Vulgar language used to demean, attack, or shock
- Note: mild/casual profanity in normal conversation is OK
- Flag when used aggressively, excessively, or directed at someone
- Multiple profanity instances = flag even if individually mild

**SEXUAL CONTENT** (violation_type: "sexual")
- Sexually explicit text, descriptions of sexual acts
- Sexual solicitation or grooming behavior
- Sharing or requesting intimate/sexual content ("nude at", "ifşa gönder")
- Sexualizing other users
- Links/references to pornographic content
- Sexual roleplay or erotic fiction

**GROOMING** (violation_type: "grooming")
- Predatory behavior patterns toward younger users
- Attempts to isolate, manipulate, or gain trust for sexual purposes
- Requesting personal photos or private meetings
- Age-inappropriate conversations

**SPAM / SCAM** (violation_type: "spam")
- Promotional spam, advertising
- Phishing attempts, suspicious links
- Repeated copy-paste messages
- Crypto/gambling/betting promotion
- MLM/pyramid scheme promotion
- "Para kazan", "yatırım fırsatı" spam

**DANGEROUS CONTENT** (violation_type: "dangerous")
- Instructions for illegal activities
- Drug dealing, weapon trade
- Academic fraud services (essay writing for money, exam cheating services, sınav kopya)
- Personal data harvesting attempts
- Malware/virus distribution
- Hacking tutorials targeting real systems

**DOXXING** (violation_type: "doxxing")
- Sharing someone's personal information without consent
- Phone numbers, addresses, TC kimlik numbers, school IDs
- Real names with intent to expose anonymous users
- Screenshots of private conversations shared to harass

## SEVERITY LEVELS:
- "low": mild/borderline — flag but may be OK (single casual profanity)
- "medium": clearly problematic — should be blocked (directed insults, mild harassment)
- "high": seriously harmful — block and escalate (threats, hate speech, sexual content)
- "critical": extreme danger, immediate action needed (self-harm encouragement, child exploitation, terrorism)

## RULES:
1. Consider Turkish language, slang, and cultural context deeply
2. Catch ALL bypass attempts: leetspeak, spacing, character substitution, reversed text, mixed alphabets
3. Normal academic discussion, casual conversation, mild humor are SAFE
4. When in doubt between "safe" and "not safe", lean toward flagging for medium+ severity
5. Context matters: "sınavda öldüm" (I died in the exam) is safe; "seni öldürürüm" (I'll kill you) is not
6. Single mild profanity in casual context = low severity; same profanity directed at someone = medium+
7. Be extra cautious with content_type "direct_message" — grooming and harassment are more common in DMs
8. Check for coded NSFW language and innuendo when clearly intentional
9. Academic criticism is allowed; personal attacks disguised as criticism are not
10. Report requests, "ifşa" content sharing/requesting is always unsafe

Use the report_moderation_result tool to return your analysis.`;

// Server-side profanity pre-check patterns (catches obvious violations before AI)
const SERVER_PROFANITY_PATTERNS = [
  /s[i1ıİ]k[i1ıİ][şsṣ§ŝ]/i,
  /s[i1ıİ]kt[i1ıİ]r/i,
  /a[mn]c[iı1ıİ][kğ]/i,
  /o[rŗ]o[sş]p[uü]/i,
  /p[i1ıİ][çc](?:[^a-zA-Z]|$)/i,
  /y[aâ]rr?[aâ][kğg]/i,
  /k[aâ]hpe/i,
  /(?:^|\s)ibne(?:\s|$|[.,!?])/i,
  /(?:^|\s)amk\b/i,
  /(?:^|\s)aq\b/i,
  /(?:^|\s)mk\b/i,
  /g[öo]tv[eé]r[eé]n/i,
];
const SERVER_THREAT_PATTERNS = [
  /öldür[üu]r[üu]m/i,
  /seni\s*(?:öldür|bıçakla|vurur|keser)/i,
  /kafan[ıi]\s*(?:kırar|kopar|keser)/i,
  /intihar\s*et/i,
  /kendini\s*(?:öldür|as|kes)/i,
];
const SERVER_SEXUAL_PATTERNS = [
  /siki[şs](?:elim|mek|me)/i,
  /nude\s*(?:at|gönder)/i,
  /ifşa\s*(?:at|gönder|izle)/i,
  /çıplak\s*(?:foto|resim|video)/i,
];

function serverSideProfanityCheck(text: string): { safe: boolean; violation_type?: string; severity?: string; reason?: string } | null {
  const normalized = text.replace(/[._\-*#@!$%^&(){}[\]|\\/<>~`]/g, "").replace(/\s{2,}/g, " ").trim();
  for (const p of SERVER_THREAT_PATTERNS) {
    if (p.test(normalized) || p.test(text)) return { safe: false, violation_type: "threat", severity: "high", reason: "Tehdit içerikli mesaj tespit edildi." };
  }
  for (const p of SERVER_SEXUAL_PATTERNS) {
    if (p.test(normalized) || p.test(text)) return { safe: false, violation_type: "sexual", severity: "high", reason: "Cinsel içerik tespit edildi." };
  }
  for (const p of SERVER_PROFANITY_PATTERNS) {
    if (p.test(normalized) || p.test(text)) return { safe: false, violation_type: "profanity", severity: "medium", reason: "Küfür/hakaret tespit edildi." };
  }
  return null;
}

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

    const { text, content_type, content_id } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ safe: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side pre-check: catch obvious violations before AI call
    const preCheck = serverSideProfanityCheck(text);
    if (preCheck) {
      // Log to moderation queue
      if (userId) {
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabaseAdmin.from("moderation_queue").insert({
          content_type: content_type || "message",
          content_id: content_id || "unknown",
          content_text: text.substring(0, 2000),
          user_id: userId,
          violation_type: preCheck.violation_type || "profanity",
          severity: preCheck.severity || "medium",
          status: "blocked",
          ai_confidence: 0.99,
        });
        const scoreMap: Record<string, number> = { threat: 3, sexual: 3, profanity: 1 };
        const points = scoreMap[preCheck.violation_type || "profanity"] || 1;
        await supabaseAdmin.rpc("increment_moderation_score", {
          p_user_id: userId,
          p_points: points,
          p_reason: preCheck.reason || preCheck.violation_type || "profanity",
        });
      }
      return new Response(JSON.stringify(preCheck), {
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
          { role: "user", content: `[content_type: ${content_type || "message"}]\n\n${text}` },
        ],
        tools: [MODERATION_TOOL],
        tool_choice: { type: "function", function: { name: "report_moderation_result" } },
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

    // Extract result from tool call (structured output, no JSON parsing needed)
    let result: { safe: boolean; violation_type: string; severity: string; confidence: number; reason: string };

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {
        // Fallback: try message content
        result = parseFallbackContent(aiData);
      }
    } else {
      // Fallback for models that may not support tool calling
      result = parseFallbackContent(aiData);
    }

    // If not safe, log to moderation queue and increment score
    if (!result.safe && userId) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const severity = result.severity || "low";
      const shouldBlock = severity === "critical" || severity === "high" || severity === "medium";

      await supabaseAdmin.from("moderation_queue").insert({
        content_type: content_type || "message",
        content_id: content_id || "unknown",
        content_text: text.substring(0, 2000),
        user_id: userId,
        violation_type: result.violation_type || "toxic",
        severity: severity,
        status: shouldBlock ? "blocked" : "flagged",
        ai_confidence: result.confidence || 0.5,
      });

      const scoreMap: Record<string, number> = {
        toxic: 1,
        profanity: 1,
        spam: 1,
        harassment: 2,
        sexual: 3,
        grooming: 4,
        hate_speech: 3,
        threat: 3,
        self_harm: 4,
        dangerous: 3,
        doxxing: 3,
      };
      const points = scoreMap[result.violation_type] || 1;
      if (severity !== "low") {
        await supabaseAdmin.rpc("increment_moderation_score", {
          p_user_id: userId,
          p_points: points,
          p_reason: result.reason || result.violation_type,
        });
      }
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
    console.error("Moderation error:", error);
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
