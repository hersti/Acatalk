import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Use real key from env, fallback to Cloudflare's always-pass test key for development
  const siteKey = Deno.env.get('TURNSTILE_SITE_KEY') || '1x00000000000000000000AA';
  
  // If the stored key looks like a placeholder/invalid value, use test key
  const finalKey = (siteKey.length < 20) ? '1x00000000000000000000AA' : siteKey;

  return new Response(JSON.stringify({ siteKey: finalKey }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
