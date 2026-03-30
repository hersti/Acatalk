import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Usernames that are reserved for system / platform use
const RESERVED_USERNAMES = new Set([
  // System
  "admin", "moderator", "mod", "support", "help", "root", "system",
  "bot", "null", "undefined", "anonymous", "guest",
  // Platform
  "acatalk", "acatalks", "acamod", "acaadmin", "acasupport",
  // Identity impersonation
  "official", "staff", "team", "security", "info", "contact", "news",
]);

const FORMAT_REGEX = /^[a-z0-9_]{3,30}$/;

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();

    if (!username || typeof username !== "string") {
      return json({ available: false, status: "invalid_format", reason: "Kullanıcı adı gerekli." }, 400);
    }

    const trimmed = username.trim().toLowerCase();

    // 1. Format check
    if (!FORMAT_REGEX.test(trimmed)) {
      return json({ available: false, status: "invalid_format", reason: "Geçersiz kullanıcı adı formatı." });
    }

    // 2. Reserved / blocklist check
    if (RESERVED_USERNAMES.has(trimmed)) {
      return json({ available: false, status: "reserved", reason: "Bu kullanıcı adı kullanılamaz." });
    }

    // 3. Uniqueness check (service role — bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await client
      .from("profiles")
      .select("id")
      .eq("username", trimmed)
      .maybeSingle();

    if (error) {
      console.error("check-username DB error:", error);
      return json({ available: false, status: "error", reason: "Kontrol sırasında hata oluştu." }, 500);
    }

    if (data) {
      return json({ available: false, status: "taken", reason: "Bu kullanıcı adı zaten kullanılıyor." });
    }

    return json({ available: true, status: "available" });

  } catch (err) {
    console.error("check-username unexpected error:", err);
    return json({ available: false, status: "error", reason: "Beklenmeyen hata." }, 500);
  }
});
