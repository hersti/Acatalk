import { supabase } from "@/integrations/supabase/client";
import { quickContentCheck } from "@/lib/profanity-filter";

interface ModerationResult {
  safe: boolean;
  violation_type?: string;
  severity?: string;
  reason?: string;
  error?: string;
}

/**
 * Moderate text content before sending.
 * First runs a fast client-side check, then AI moderation.
 */
export async function moderateText(
  text: string,
  contentType: string = "message",
  contentId: string = "unknown"
): Promise<ModerationResult> {
  if (!text.trim()) return { safe: true };

  // Fast client-side profanity check
  const quickCheck = quickContentCheck(text);
  if (!quickCheck.safe) {
    // Still log to moderation queue via edge function (fire-and-forget)
    try {
      supabase.functions.invoke("moderate-text", {
        body: { text, content_type: contentType, content_id: contentId },
      });
    } catch {}
    return {
      safe: false,
      violation_type: quickCheck.violation_type,
      severity: "high",
      reason: quickCheck.reason,
    };
  }

  try {
    const response = await supabase.functions.invoke("moderate-text", {
      body: { text, content_type: contentType, content_id: contentId },
    });

    if (response.error) {
      console.error("Text moderation error:", response.error);
      return { safe: true, error: "moderation_unavailable" };
    }

    return response.data as ModerationResult;
  } catch (err) {
    console.error("Text moderation failed:", err);
    return { safe: true, error: "moderation_error" };
  }
}

/**
 * Moderate an image before making it public.
 */
export async function moderateImage(
  imageUrl: string,
  contentType: string = "image",
  contentId: string = "unknown"
): Promise<ModerationResult> {
  if (!imageUrl) return { safe: true };

  try {
    const response = await supabase.functions.invoke("moderate-image", {
      body: { image_url: imageUrl, content_type: contentType, content_id: contentId },
    });

    if (response.error) {
      console.error("Image moderation error:", response.error);
      return { safe: true, error: "moderation_unavailable" };
    }

    return response.data as ModerationResult;
  } catch (err) {
    console.error("Image moderation failed:", err);
    return { safe: true, error: "moderation_error" };
  }
}

/**
 * Check if the current user is muted or suspended.
 */
export async function checkUserModerationStatus(userId: string): Promise<{
  canPost: boolean;
  reason?: string;
  remainingTime?: string;
}> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("is_muted, muted_until, is_suspended, suspended_until, moderation_score")
      .eq("user_id", userId)
      .maybeSingle();

    if (!data) return { canPost: true };

    const now = new Date();

    // Check suspension first (higher priority)
    if (data.is_suspended) {
      if (data.suspended_until) {
        const until = new Date(data.suspended_until);
        if (until > now) {
          const remaining = formatRemainingTime(until, now);
          return { 
            canPost: false, 
            reason: `Hesabınız askıya alınmıştır. Kalan süre: ${remaining}.`,
            remainingTime: remaining 
          };
        } else {
          // Auto-clear expired suspension client-side (DB function also handles this)
          supabase.from("profiles").update({
            is_suspended: false,
            suspended_until: null,
          } as any).eq("user_id", userId).then(() => {});
        }
      } else {
        // Permanent suspension (no end date)
        return { canPost: false, reason: "Hesabınız askıya alınmıştır. Detaylar için destek ile iletişime geçin." };
      }
    }

    // Check mute
    if (data.is_muted) {
      if (data.muted_until) {
        const until = new Date(data.muted_until);
        if (until > now) {
          const remaining = formatRemainingTime(until, now);
          return { 
            canPost: false, 
            reason: `Sohbet özelliğiniz engellenmiştir. Kalan süre: ${remaining}.`,
            remainingTime: remaining 
          };
        } else {
          // Auto-clear expired mute
          supabase.from("profiles").update({
            is_muted: false,
            muted_until: null,
          } as any).eq("user_id", userId).then(() => {});
        }
      }
    }

    return { canPost: true };
  } catch {
    return { canPost: true };
  }
}

/** Format remaining penalty time in Turkish */
function formatRemainingTime(until: Date, now: Date): string {
  const diffMs = until.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} gün ${diffHours % 24} saat`;
  } else if (diffHours > 0) {
    return `${diffHours} saat ${diffMins % 60} dakika`;
  } else {
    return `${Math.max(1, diffMins)} dakika`;
  }
}

/** User-facing violation messages */
export function getViolationMessage(violationType?: string): string {
  const messages: Record<string, string> = {
    toxic: "Bu mesaj kötüye kullanım içeriyor ve platform kurallarını ihlal ediyor.",
    harassment: "Bu mesaj taciz içeriyor ve platform kurallarını ihlal ediyor.",
    hate_speech: "Bu mesaj nefret söylemi içeriyor ve platform kurallarını ihlal ediyor.",
    threat: "Bu mesaj tehdit içeriyor ve platform kurallarını ihlal ediyor.",
    profanity: "Bu mesaj aşırı küfür içeriyor ve platform kurallarını ihlal ediyor.",
    sexual: "Bu mesaj cinsel içerik barındırıyor ve platform kurallarını ihlal ediyor.",
    spam: "Bu mesaj spam/promosyon içeriyor ve platform kurallarını ihlal ediyor.",
    dangerous: "Bu mesaj tehlikeli içerik barındırıyor ve platform kurallarını ihlal ediyor.",
    nsfw: "Bu görsel platform güvenlik kurallarını ihlal ediyor ve yüklenemez.",
    nudity: "Bu görsel uygunsuz içerik barındırıyor ve yüklenemez.",
    violence: "Bu görsel şiddet içeriyor ve yüklenemez.",
    hate: "Bu görsel nefret söylemi/sembolleri içeriyor ve yüklenemez.",
    drugs: "Bu görsel uyuşturucu içeriği barındırıyor ve yüklenemez.",
    disturbing: "Bu görsel rahatsız edici içerik barındırıyor ve yüklenemez.",
    self_harm: "Bu içerik kendine zarar vermeyi teşvik ediyor ve platform kurallarını ihlal ediyor.",
    grooming: "Bu içerik uygunsuz davranış kalıpları içeriyor ve platform kurallarını ihlal ediyor.",
    doxxing: "Kişisel bilgi paylaşımı platform kurallarını ihlal ediyor.",
    illegal: "Bu içerik yasadışı faaliyet içeriyor ve platform kurallarını ihlal ediyor.",
  };
  return messages[violationType || ""] || "Bu içerik platform kurallarını ihlal ediyor.";
}
