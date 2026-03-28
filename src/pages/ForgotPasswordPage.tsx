import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-logger";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const sendReset = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await logSecurityEvent("password_reset_request", { email });
      setSent(true);
      setResendCooldown(60);
      toast.success("Şifre sıfırlama bağlantısı gönderildi.");
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const isEduEmail = email.includes(".edu.tr");

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <Card className="border-0" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <div className="h-12 w-12 rounded-xl gradient-hero flex items-center justify-center">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="font-heading text-xl font-extrabold">Şifremi Unuttum</CardTitle>
            <CardDescription className="text-xs">
              {sent
                ? "E-postanıza bir sıfırlama bağlantısı gönderdik."
                : "E-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!sent ? (
              <form onSubmit={(e) => { e.preventDefault(); sendReset(); }} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@universite.edu.tr"
                    required
                    className="h-10 rounded-lg"
                  />
                </div>
                <Button type="submit" className="w-full h-10 rounded-lg font-semibold" disabled={loading}>
                  {loading ? "Gönderiliyor..." : "Sıfırlama Bağlantısı Gönder"}
                </Button>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  <span className="font-semibold text-foreground">{email}</span> adresine sıfırlama bağlantısı gönderildi.
                </p>

                {isEduEmail && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div className="text-[11px] text-warning-foreground">
                      <p className="font-semibold">Üniversite e-postası kullanıyorsanız:</p>
                      <ul className="mt-1 space-y-0.5">
                        <li>• <strong>Spam/Gereksiz</strong> klasörünüzü kontrol edin</li>
                        <li>• E-posta gelmesi birkaç dakika sürebilir</li>
                      </ul>
                    </div>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground">
                  E-posta gelmezse spam klasörünüze bakın veya tekrar gönderin.
                </p>

                <Button
                  onClick={() => sendReset()}
                  variant="outline"
                  className="w-full h-10 rounded-lg font-semibold text-sm"
                  disabled={loading || resendCooldown > 0}
                >
                  {resendCooldown > 0
                    ? `Tekrar gönder (${resendCooldown}s)`
                    : "Sıfırlama E-postasını Tekrar Gönder"}
                </Button>
              </div>
            )}
            <div className="mt-4 text-center">
              <Link to="/auth" className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Giriş sayfasına dön
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
