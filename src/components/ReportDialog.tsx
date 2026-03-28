import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Flag } from "lucide-react";
import { toast } from "sonner";

interface ReportDialogProps {
  targetType: "post" | "comment" | "user" | "message" | "file" | "discussion" | "avatar";
  targetId: string;
  trigger?: React.ReactNode;
}

const REASONS = [
  { value: "inappropriate", label: "Uygunsuz içerik" },
  { value: "harassment", label: "Taciz / Zorbalık" },
  { value: "hate_speech", label: "Nefret söylemi" },
  { value: "spam", label: "Spam veya reklam" },
  { value: "nsfw", label: "NSFW / Müstehcen içerik" },
  { value: "copyright", label: "Telif hakkı ihlali" },
  { value: "impersonation", label: "Kimlik taklidi" },
  { value: "misinformation", label: "Yanlış bilgi" },
  { value: "other", label: "Diğer" },
];

const TARGET_LABELS: Record<string, string> = {
  post: "Gönderi",
  comment: "Yorum",
  user: "Kullanıcı",
  message: "Mesaj",
  file: "Dosya",
  discussion: "Tartışma",
  avatar: "Avatar",
};

export default function ReportDialog({ targetType, targetId, trigger }: ReportDialogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !reason || loading) return;
    setLoading(true);

    const reasonLabel = REASONS.find(r => r.value === reason)?.label || reason;
    const fullReason = details.trim() ? `${reasonLabel}: ${details.trim()}` : reasonLabel;

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: targetType,
      target_id: targetId,
      reason: fullReason,
    } as any);

    if (error) {
      toast.error("Bildirim gönderilemedi.");
    } else {
      toast.success("Raporunuz alınmıştır ve moderasyon ekibi tarafından incelenecektir.", {
        duration: 5000,
      });
      setOpen(false);
      setReason("");
      setDetails("");
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) { setReason(""); setDetails(""); }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
            <Flag className="h-3 w-3" /> Bildir
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">
            {TARGET_LABELS[targetType] || "İçerik"} Bildir
          </DialogTitle>
          <DialogDescription>Bu içeriği neden bildirmek istediğinizi belirtin.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Sebep</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Bir sebep seçin" /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Detay (isteğe bağlı)</Label>
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Ek bilgi ekleyin..." rows={3} maxLength={500} className="text-sm" />
          </div>
          <Button onClick={handleSubmit} disabled={loading || !reason} className="w-full">
            {loading ? "Gönderiliyor..." : "Bildir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
