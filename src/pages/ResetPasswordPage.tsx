import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPasswordStrong } from "@/lib/password-validation";
import { logSecurityEvent } from "@/lib/security-logger";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

function PasswordInput({
  id, value, onChange, placeholder = "••••••••",
}: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={8}
        className="h-10 rounded-lg pr-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
        aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setValid(true);
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setValid(true);
        else {
          toast.error("Geçersiz veya süresi dolmuş bağlantı.");
          navigate("/auth");
        }
      });
    }
  }, []);

  const passwordsMatch = confirm.length > 0 && password === confirm;
  const passwordsMismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordStrong(password)) {
      toast.error("Şifre güvenlik gereksinimlerini karşılamıyor.");
      return;
    }
    if (password !== confirm) {
      toast.error("Şifreler eşleşmiyor.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await logSecurityEvent("password_reset_complete");
      toast.success("Şifreniz başarıyla güncellendi!");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Şifre güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  if (!valid) return null;

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
            <CardTitle className="font-heading text-xl font-extrabold">Yeni Şifre Belirle</CardTitle>
            <CardDescription className="text-xs">Güçlü bir şifre seçin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold">Yeni Şifre</Label>
                <PasswordInput id="password" value={password} onChange={setPassword} />
                <PasswordStrengthIndicator password={password} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-semibold">Şifreyi Onayla</Label>
                <PasswordInput id="confirm" value={confirm} onChange={setConfirm} />
                {passwordsMatch && (
                  <p className="text-[10px] text-success flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Şifreler eşleşiyor
                  </p>
                )}
                {passwordsMismatch && (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Şifreler eşleşmiyor
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full h-10 rounded-lg font-semibold" disabled={loading || !isPasswordStrong(password) || !passwordsMatch}>
                {loading ? "Güncelleniyor..." : "Şifreyi Güncelle"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
