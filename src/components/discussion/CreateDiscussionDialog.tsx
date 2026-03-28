import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import MentionInput from "@/components/MentionInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { DISCUSSION_TYPES } from "./DiscussionPanel";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";

interface Props {
  courseId: string;
  onCreated: (newPostId?: string) => void;
}

export default function CreateDiscussionDialog({ courseId, onCreated }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [discussionType, setDiscussionType] = useState("soru");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || loading) return;

    // Instant client-side block
    const textToCheck = `${title.trim()} ${content.trim()}`;
    const quickCheck = quickContentCheck(textToCheck);
    if (!quickCheck.safe) {
      toast.error(quickCheck.reason || "İçerik platform kurallarını ihlal ediyor.");
      return;
    }

    setLoading(true);
    try {
      const status = await checkUserModerationStatus(user.id);
      if (!status.canPost) {
        toast.error(status.reason || "İçerik göndermeniz engellenmiştir.");
        return;
      }

      const textToModerate = `${title.trim()} ${content.trim()}`;

      // Check URLs for safety
      const urlCheck = checkTextUrls(textToModerate);
      if (!urlCheck.safe) {
        toast.error(urlCheck.reason || "İçeriğinizdeki bir bağlantı platform kurallarını ihlal ediyor.");
        return;
      }

      const modResult = await moderateText(textToModerate, "discussion", courseId);
      if (!modResult.safe) {
        toast.error(getViolationMessage(modResult.violation_type));
        return;
      }

      const { data: newPost, error } = await supabase.from("posts").insert({
        user_id: user.id,
        course_id: courseId,
        title: title.trim(),
        content: content.trim() || null,
        content_type: "discussion" as any,
        is_anonymous: isAnonymous,
        discussion_type: discussionType,
      } as any).select("id").single();
      if (error) throw error;
      toast.success("Tartışma oluşturuldu!");
      setTitle("");
      setContent("");
      setIsAnonymous(false);
      setDiscussionType("soru");
      setOpen(false);
      onCreated(newPost?.id);
    } catch (err: any) {
      toast.error(err.message || "Oluşturulamadı");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const types = DISCUSSION_TYPES.filter((t) => t.value !== "all");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs">
          <Plus className="h-4 w-4" /> Yeni Tartışma
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Tartışma Başlat</DialogTitle>
          <DialogDescription>Bu ders hakkında yeni bir tartışma başlatın.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tartışma Türü</Label>
            <Select value={discussionType} onValueChange={setDiscussionType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Başlık</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tartışma başlığı..." required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>İçerik</Label>
            <MentionInput value={content} onChange={setContent} placeholder="Detayları yazın..." rows={4} maxLength={5000} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="anon-disc" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
            <label htmlFor="anon-disc" className="text-sm text-muted-foreground">Anonim olarak paylaş</label>
          </div>
          <Button type="submit" className="w-full" disabled={loading || !title.trim()}>
            {loading ? "Gönderiliyor..." : "Tartışma Başlat"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}