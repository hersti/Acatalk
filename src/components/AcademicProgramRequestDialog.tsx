import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export type ProgramRequestContext = "signup" | "content_add";

interface AcademicProgramRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ProgramRequestContext;
  defaultUniversityId?: string | null;
  defaultUniversityName?: string | null;
  requesterEmail?: string | null;
  onSubmitted?: () => void;
}

export default function AcademicProgramRequestDialog({
  open,
  onOpenChange,
  context,
  defaultUniversityId,
  defaultUniversityName,
  requesterEmail,
  onSubmitted,
}: AcademicProgramRequestDialogProps) {
  const [programName, setProgramName] = useState("");
  const [programLevel, setProgramLevel] = useState<"lisans" | "onlisans">("lisans");
  const [unitName, setUnitName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setProgramName("");
    setProgramLevel("lisans");
    setUnitName("");
    setNote("");
    setResultMessage("");
  }, [open]);

  const submitFallback = async () => {
    const payload = {
      requester_user_id: context === "content_add" ? (await supabase.auth.getUser()).data.user?.id ?? null : null,
      requester_email: context === "signup" ? (requesterEmail || null) : null,
      requester_email_domain:
        context === "signup" && requesterEmail?.includes("@")
          ? requesterEmail.split("@")[1].trim().toLowerCase()
          : null,
      request_context: context,
      university_id: defaultUniversityId,
      university_name: defaultUniversityName,
      requested_program_name: programName.trim(),
      requested_program_level: programLevel,
      requested_unit_name: unitName.trim() || null,
      request_note: note.trim() || null,
      status: "pending",
    };

    const { error } = await supabase.from("academic_program_requests" as any).insert(payload as any);
    if (error) throw error;

    return { ok: true, reason: "Talebiniz admin onayýna gönderildi." };
  };

  const handleSubmit = async () => {
    if (!defaultUniversityId || !defaultUniversityName) {
      toast.error("Üniversite bilgisi bulunamadý. Lütfen tekrar deneyin.");
      return;
    }

    if (!programName.trim()) {
      toast.error("Program/Bölüm adý zorunludur.");
      return;
    }

    if (context === "signup" && !requesterEmail?.trim()) {
      toast.error("Signup baðlamýnda e-posta bilgisi gerekli.");
      return;
    }

    setSubmitting(true);
    try {
      const params = {
        p_request_context: context,
        p_university_id: defaultUniversityId,
        p_requested_program_name: programName.trim(),
        p_requested_program_level: programLevel,
        p_requested_unit_name: unitName.trim() || null,
        p_request_note: note.trim() || null,
        p_requester_email: context === "signup" ? requesterEmail?.trim().toLowerCase() || null : null,
      };

      const { data, error } = await supabase.rpc("create_academic_program_request", params as any);
      const rpcMissing =
        !!error &&
        ((error as any)?.code === "PGRST202" || String((error as any)?.message || "").includes("Could not find the function"));

      if (error && !rpcMissing) {
        throw error;
      }

      const result = rpcMissing ? await submitFallback() : (data as any);
      if (!result?.ok) {
        setResultMessage(result?.reason || "Talep gönderilemedi.");
        toast.error(result?.reason || "Talep gönderilemedi.");
        return;
      }

      if (result?.already_exists) {
        setResultMessage(result.reason || "Bu program zaten katalogda mevcut.");
        toast.info(result.reason || "Bu program zaten katalogda mevcut.");
        return;
      }

      setResultMessage(result?.reason || "Talebiniz admin onayýna gönderildi.");
      toast.success(result?.reason || "Talebiniz admin onayýna gönderildi.");
      onSubmitted?.();
      setTimeout(() => onOpenChange(false), 600);
    } catch (err: any) {
      const message = err?.message || "Talep gönderilirken bir hata oluþtu.";
      setResultMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Program/Bölüm Talebi</DialogTitle>
          <DialogDescription className="text-xs">
            Bu form AI doðrulamasý olmadan admin onayýna gider. Onay sonrasý katalogda herkese açýlýr.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Üniversite</Label>
            <Input value={defaultUniversityName || ""} disabled className="h-9 text-sm bg-secondary/50" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Program/Bölüm Adý <span className="text-destructive">*</span></Label>
            <Input
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="Örn: Bilgisayar Mühendisliði"
              maxLength={200}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Program Seviyesi</Label>
              <Select value={programLevel} onValueChange={(value) => setProgramLevel(value as "lisans" | "onlisans") }>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lisans">Lisans</SelectItem>
                  <SelectItem value="onlisans">Önlisans</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fakülte/Yüksekokul</Label>
              <Input
                value={unitName}
                onChange={(e) => setUnitName(e.target.value)}
                placeholder="Opsiyonel"
                maxLength={200}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Not</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eklemek istediðiniz açýklama"
              rows={2}
              maxLength={500}
              className="text-sm"
            />
          </div>

          {resultMessage && (
            <p className="text-xs text-muted-foreground bg-secondary/40 p-2 rounded-md">{resultMessage}</p>
          )}

          <Button onClick={handleSubmit} disabled={submitting || !programName.trim()} className="w-full h-9">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Talep Gönder
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
