import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Shield, ShieldCheck, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  enabled: boolean;
  onStatusChange: () => void;
}

export default function TwoFactorSetup({ enabled, onStatusChange }: Props) {
  const [step, setStep] = useState<"idle" | "enroll" | "verify">("idle");
  const [qrUrl, setQrUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (error) throw error;
      setQrUrl(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep("enroll");
    } catch (err: any) {
      toast.error(err.message || "2FA kurulumu başlatılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;

      await logSecurityEvent("2fa_enabled");
      toast.success("İki faktörlü kimlik doğrulama etkinleştirildi!");
      setStep("idle");
      onStatusChange();
    } catch (err: any) {
      toast.error(err.message || "Doğrulama kodu geçersiz.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnenroll = async () => {
    setLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors?.totp?.[0];
      if (!totpFactor) {
        toast.error("Aktif 2FA bulunamadı.");
        return;
      }
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;
      await logSecurityEvent("2fa_disabled");
      toast.success("İki faktörlü kimlik doğrulama devre dışı bırakıldı.");
      onStatusChange();
    } catch (err: any) {
      toast.error(err.message || "2FA devre dışı bırakılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "enroll") {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Shield className="h-4 w-4" /> 2FA Kurulumu
          </CardTitle>
          <CardDescription className="text-xs">
            Google Authenticator, Microsoft Authenticator veya Authy ile tarayın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <img src={qrUrl} alt="QR Code" className="w-48 h-48 rounded-lg border" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Manuel giriş anahtarı</Label>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-muted px-2 py-1.5 rounded flex-1 break-all">{secret}</code>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copySecret}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <form onSubmit={handleVerify} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Doğrulama Kodu</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="h-10 rounded-lg text-center text-lg tracking-widest font-mono"
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 h-10 rounded-lg" onClick={() => setStep("idle")}>
                İptal
              </Button>
              <Button type="submit" className="flex-1 h-10 rounded-lg font-semibold" disabled={loading || code.length !== 6}>
                {loading ? "Doğrulanıyor..." : "Etkinleştir"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          {enabled ? <ShieldCheck className="h-4 w-4 text-success" /> : <Shield className="h-4 w-4" />}
          İki Faktörlü Kimlik Doğrulama (2FA)
        </CardTitle>
        <CardDescription className="text-xs">
          {enabled
            ? "2FA aktif. Hesabınız ekstra güvenlik katmanıyla korunuyor."
            : "Hesabınıza ek güvenlik katmanı ekleyin."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {enabled ? (
          <Button variant="destructive" size="sm" className="rounded-lg" onClick={handleUnenroll} disabled={loading}>
            {loading ? "İşleniyor..." : "2FA'yı Devre Dışı Bırak"}
          </Button>
        ) : (
          <Button size="sm" className="rounded-lg font-semibold" onClick={handleEnroll} disabled={loading}>
            {loading ? "Yükleniyor..." : "2FA'yı Etkinleştir"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
