import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logSecurityEvent } from "@/lib/security-logger";
import { motion } from "framer-motion";

import AuthTrustPanel from "@/components/auth/AuthTrustPanel";
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
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      await logSecurityEvent("password_reset_request", { email });
      setSent(true);
      setResendCooldown(60);
      toast.success("Sifre sifirlama baglantisi gonderildi.");
    } catch (err: any) {
      toast.error(err.message || "Bir hata olustu.");
    } finally {
      setLoading(false);
    }
  };

  const isEduEmail = email.includes(".edu.tr");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid items-start gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="hidden lg:block">
            <AuthTrustPanel mode="recovery" />
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-sm">
            <Card className="border-0" style={{ boxShadow: "var(--shadow-elevated)" }}>
              <CardHeader className="pb-2 text-center">
                <div className="mb-2 inline-flex items-center justify-center rounded-full border border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Guvenli Hesap Kurtarma
                </div>
                <div className="mb-3 flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-hero">
                    <GraduationCap className="h-6 w-6 text-primary-foreground" />
                  </div>
                </div>
                <CardTitle className="font-heading text-xl font-extrabold">Sifremi Unuttum</CardTitle>
                <CardDescription className="text-xs">
                  {sent
                    ? "E-postaniza bir sifirlama baglantisi gonderdik."
                    : "E-posta adresinizi girin, sifre sifirlama baglantisi gonderelim."}
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
                    <Button type="submit" className="h-10 w-full rounded-lg font-semibold" disabled={loading}>
                      {loading ? "Gonderiliyor..." : "Sifirlama Baglantisi Gonder"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <p className="text-center text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{email}</span> adresine sifirlama baglantisi gonderildi.
                    </p>

                    {isEduEmail && (
                      <div className="flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <div className="text-[11px] text-warning-foreground">
                          <p className="font-semibold">Universite e-postasi kullaniyorsaniz:</p>
                          <ul className="mt-1 space-y-0.5">
                            <li>- Spam/Gereksiz klasorunuzu kontrol edin</li>
                            <li>- E-posta gelmesi birkac dakika surebilir</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    <p className="text-center text-xs text-muted-foreground">
                      E-posta gelmezse spam klasorunuze bakin veya tekrar gonderin.
                    </p>

                    <Button
                      onClick={() => sendReset()}
                      variant="outline"
                      className="h-10 w-full rounded-lg text-sm font-semibold"
                      disabled={loading || resendCooldown > 0}
                    >
                      {resendCooldown > 0
                        ? `Tekrar gonder (${resendCooldown}s)`
                        : "Sifirlama E-postasini Tekrar Gonder"}
                    </Button>
                  </div>
                )}

                <div className="mt-4 text-center">
                  <Link to="/auth" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <ArrowLeft className="h-3 w-3" /> Giris sayfasina don
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

