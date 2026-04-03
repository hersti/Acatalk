import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { toast } from "sonner";
import { HelpCircle, Send, Loader2 } from "lucide-react";
import { quickContentCheck } from "@/lib/profanity-filter";

export default function SupportButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || !subject.trim() || !message.trim()) return;
    setLoading(true);

    // Moderate support ticket content
    const textToCheck = `${subject.trim()} ${message.trim()}`;
    const quickCheck = quickContentCheck(textToCheck);
    if (!quickCheck.safe) {
      toast.error(quickCheck.reason || "İçerik platform kurallarını ihlal ediyor.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("support_tickets" as any).insert({
      user_id: user.id,
      subject: subject.trim(),
      message: message.trim(),
    });
    if (error) {
      toast.error("Gönderilemedi: " + error.message);
    } else {
      toast.success("Destek talebiniz gönderildi. En kısa sürede yanıtlanacaktır.");
      setSubject("");
      setMessage("");
      setOpen(false);
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground transition-all flex items-center justify-center hover:scale-105"
        style={{ boxShadow: 'var(--shadow-elevated)' }}
        aria-label="Destek"
        title="Destek / Yardım"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Destek Talebi
            </DialogTitle>
          </DialogHeader>
          <Surface variant="soft" border="subtle" padding="md" radius="lg" className="space-y-4">
            <p className="text-[11px] text-muted-foreground">
              Talebiniz hesabınızla ilişkilendirilir ve en kısa sürede yanıtlanır.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Konu <span className="text-destructive">*</span></Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sorun veya soru başlığı..."
                maxLength={200}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mesaj <span className="text-destructive">*</span></Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Sorunuzu veya sorununuzu detaylı açıklayın..."
                rows={4}
                maxLength={2000}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground text-right">{message.length}/2000</p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={loading || !subject.trim() || !message.trim()}
              className="w-full h-10 gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {loading ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </Surface>
        </DialogContent>
      </Dialog>
    </>
  );
}
