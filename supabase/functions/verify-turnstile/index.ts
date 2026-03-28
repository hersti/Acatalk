import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const secretKey = Deno.env.get('TURNSTILE_SECRET_KEY');
    const isPlaceholderSecret = !secretKey || secretKey.length < 32 || secretKey === 'admin123';

    // Dev/test mode fallback: don't block auth if secret is missing/placeholder
    if (isPlaceholderSecret) {
      return new Response(JSON.stringify({ success: true, mode: 'dev-bypass' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);

    const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const outcome = await result.json();

    return new Response(JSON.stringify({ success: outcome.success }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Verification failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
