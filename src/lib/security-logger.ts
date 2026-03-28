import { supabase } from "@/integrations/supabase/client";

type SecurityEvent =
  | "login_success"
  | "login_failed"
  | "signup"
  | "password_reset_request"
  | "password_reset_complete"
  | "2fa_enabled"
  | "2fa_disabled"
  | "account_locked"
  | "suspicious_login"
  | "logout";

export async function logSecurityEvent(
  eventType: SecurityEvent,
  metadata: Record<string, unknown> = {},
  userId?: string
) {
  try {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    await supabase.from("security_logs").insert({
      user_id: uid || null,
      event_type: eventType,
      user_agent: navigator.userAgent,
      metadata,
    } as any);
  } catch {
    // Silent fail — logging should never break UX
  }
}

export async function recordLoginAttempt(email: string, success: boolean) {
  try {
    await supabase.from("login_attempts").insert({
      email,
      success,
    } as any);
  } catch {
    // Silent fail
  }
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function checkLoginLockout(email: string): Promise<{ locked: boolean; minutesLeft: number }> {
  try {
    const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("login_attempts")
      .select("id, success")
      .eq("email", email)
      .gte("created_at", since)
      .eq("success", false)
      .order("created_at", { ascending: false }) as any;

    if (error || !data) return { locked: false, minutesLeft: 0 };

    if (data.length >= MAX_ATTEMPTS) {
      return { locked: true, minutesLeft: LOCKOUT_MINUTES };
    }
    return { locked: false, minutesLeft: 0 };
  } catch {
    return { locked: false, minutesLeft: 0 };
  }
}
