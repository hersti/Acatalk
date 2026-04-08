import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Surface } from "@/components/ui/surface";
import { Plus, Upload, X, FileText, ClipboardList, BookMarked, Link as LinkIcon, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize } from "@/lib/content-renderer";
import { checkTextUrls } from "@/lib/moderate-url";
import type { Database } from "@/integrations/supabase/types";
import { moderateText, moderateImage, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { quickContentCheck } from "@/lib/profanity-filter";

type ContentType = Database["public"]["Enums"]["content_type"];

interface CreatePostDialogProps {
  courseId: string;
  defaultType?: ContentType;
  onCreated: (createdType?: ContentType) => void;
  lockedContentType?: ContentType;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const TYPE_CONFIG: Record<ContentType, {
  label: string;
  icon: typeof FileText;
  titlePlaceholder: string;
  contentPlaceholder: string;
  contentLabel: string;
  helperText: string;
  showFile: boolean;
  showLink: boolean;
  showExamMeta: boolean;
  showResourceType: boolean;
}> = {
  notes: {
    label: "Notlar",
    icon: FileText,
    titlePlaceholder: "Örn: Vize 2024 Ders Notları",
    contentPlaceholder: "Notlarınız hakkında kısa bir açıklama yazın. Hangi konuları kapsıyor, hangi hoca için hazırlandı vb.",
    contentLabel: "Açıklama",
    helperText: "Ders notu, özet, formül sayfası veya çalışma materyali paylaşın.",
    showFile: true,
    showLink: false,
    showExamMeta: false,
    showResourceType: false,
  },
  past_exams: {
    label: "Geçmiş Sınavlar",
    icon: ClipboardList,
    titlePlaceholder: "Örn: 2024 Vize Sınavı ve Çözümleri",
    contentPlaceholder: "Sınavın yılı, dönemi ve varsa ek bilgileri yazın.",
    contentLabel: "Açıklama",
    helperText: "Geçmiş sınavlar, çözümler ve sınav deneyimlerini paylaşın.",
    showFile: true,
    showLink: false,
    showExamMeta: true,
    showResourceType: false,
  },
  discussion: {
    label: "Tartışma",
    icon: FileText,
    titlePlaceholder: "Tartışma başlığı...",
    contentPlaceholder: "Sorunuzu veya tartışma konunuzu detaylı yazın...",
    contentLabel: "İçerik",
    helperText: "Soru sorun, deneyim paylaşın veya ders hakkında tartışma başlatın.",
    showFile: false,
    showLink: false,
    showExamMeta: false,
    showResourceType: false,
  },
  kaynaklar: {
    label: "Kaynaklar",
    icon: BookMarked,
    titlePlaceholder: "Örn: Fizik I için harika bir YouTube serisi",
    contentPlaceholder: "Kaynak hakkında kısa bir açıklama yazın. Neden faydalı olduğunu belirtin.",
    contentLabel: "Açıklama",
    helperText: "Kitap, video, web sitesi veya diğer faydalı kaynakları paylaşın.",
    showFile: true,
    showLink: true,
    showExamMeta: false,
    showResourceType: true,
  },
};

const RESOURCE_TYPES = [
  { value: "website", label: "Web Sitesi" },
  { value: "video", label: "Video" },
  { value: "book", label: "Kitap" },
  { value: "pdf", label: "PDF Doküman" },
  { value: "other", label: "Diğer" },
];

const EXAM_PERIODS = [
  { value: "vize", label: "Vize" },
  { value: "final", label: "Final" },
  { value: "butunleme", label: "Bütünleme" },
  { value: "quiz", label: "Quiz" },
  { value: "odev", label: "Ödev" },
];

const ALLOWED_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
  ".txt", ".zip", ".rar",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const CONTENT_TYPE_OPTIONS: Array<{
  value: ContentType;
  label: string;
  icon: typeof FileText;
  iconClassName: string;
}> = [
  { value: "notes", label: "Notlar", icon: FileText, iconClassName: "text-notes" },
  { value: "past_exams", label: "Geçmiş Sınavlar", icon: ClipboardList, iconClassName: "text-exams" },
  { value: "discussion", label: "Tartışma", icon: MessageSquare, iconClassName: "text-discussion" },
  { value: "kaynaklar", label: "Kaynaklar", icon: BookMarked, iconClassName: "text-kaynaklar" },
];

function isContentType(value: string): value is ContentType {
  return value in TYPE_CONFIG;
}

export default function CreatePostDialog({
  courseId,
  defaultType = "notes",
  onCreated,
  lockedContentType,
  externalOpen,
  onOpenChange,
}: CreatePostDialogProps) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) { onOpenChange?.(v); }
    else { setInternalOpen(v); }
  };
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>(lockedContentType ?? defaultType);
  useEffect(() => {
    setContentType(lockedContentType ?? defaultType);
  }, [defaultType, lockedContentType]);
  const [file, setFile] = useState<File | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [resourceType, setResourceType] = useState("website");
  const [linkUrl, setLinkUrl] = useState("");
  const [examYear, setExamYear] = useState("");
  const [examPeriod, setExamPeriod] = useState("vize");

  const config = TYPE_CONFIG[contentType];

  const resetForm = () => {
    setTitle(""); setContent(""); setFile(null); setIsAnonymous(false);
    setResourceType("website"); setLinkUrl(""); setExamYear(""); setExamPeriod("vize");
  };

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) { setFile(null); return; }
    if (selectedFile.size > MAX_FILE_SIZE) {
      toast.error("Dosya boyutu 50 MB'ı aşamaz.");
      return;
    }
    const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast.error(`Desteklenmeyen dosya formatı. Desteklenen: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    setFile(selectedFile);
  };

  const validateTypeSpecificFields = (): string | null => {
    const trimmedContent = content.trim();
    const trimmedExamYear = examYear.trim();
    const trimmedLink = linkUrl.trim();

    if (contentType === "discussion") {
      if (trimmedContent.length < 15) {
        return "Tartışma içeriğini en az 15 karakter olacak şekilde detaylandırın.";
      }
      return null;
    }

    if (contentType === "notes") {
      if (!file && trimmedContent.length < 20) {
        return "Not paylaşımında dosya ekleyin veya açıklamayı en az 20 karakter yazın.";
      }
      return null;
    }

    if (contentType === "past_exams") {
      if (!/^\d{4}$/.test(trimmedExamYear)) {
        return "Geçmiş sınav paylaşımı için 4 haneli sınav yılı zorunludur.";
      }
      const parsedYear = Number(trimmedExamYear);
      const currentYear = new Date().getFullYear();
      if (parsedYear < 1990 || parsedYear > currentYear + 1) {
        return `Sınav yılı 1990 ile ${currentYear + 1} arasında olmalıdır.`;
      }
      if (!file && trimmedContent.length < 10) {
        return "Sınav paylaşımında dosya ekleyin veya açıklamayı en az 10 karakter yazın.";
      }
      return null;
    }

    if (contentType === "kaynaklar") {
      if (!trimmedLink && !file) {
        return "Kaynak paylaşımında bağlantı veya dosya eklemeniz gerekir.";
      }
      if (trimmedLink) {
        try {
          const parsed = new URL(trimmedLink);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "Kaynak bağlantısı geçerli bir http/https URL olmalıdır.";
          }
        } catch {
          return "Kaynak bağlantısı geçerli bir URL formatında olmalıdır.";
        }
      }
      return null;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || loading) return;

    const validationMessage = validateTypeSpecificFields();
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    // Instant client-side block before any async work
    const textToCheck = `${title.trim()} ${content.trim()} ${linkUrl.trim()}`;
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
        setLoading(false);
        return;
      }

      // Moderate text content
      const textToModerate = `${title.trim()} ${content.trim()} ${linkUrl.trim()}`;
      const modResult = await moderateText(textToModerate, "post");
      if (!modResult.safe) {
        toast.error(getViolationMessage(modResult.violation_type));
        setLoading(false);
        return;
      }

      // Check URLs for safety
      const urlCheck = checkTextUrls(textToModerate);
      if (!urlCheck.safe) {
        toast.error(urlCheck.reason || "İçeriğinizdeki bir bağlantı platform kurallarını ihlal ediyor.");
        setLoading(false);
        return;
      }

      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const filePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);
        fileUrl = urlData.publicUrl;
        fileName = file.name;

        // Moderate image if it's an image file
        if (file.type.startsWith("image/")) {
          const imgMod = await moderateImage(fileUrl, "post_image");
          if (!imgMod.safe) {
            await supabase.storage.from("uploads").remove([filePath]);
            toast.error(getViolationMessage(imgMod.violation_type));
            setLoading(false);
            return;
          }
        }
      }

      // Build content with metadata
      let fullContent = content.trim() || null;
      if (contentType === "past_exams" && (examYear || examPeriod)) {
        const meta = [examYear && `Yıl: ${examYear}`, examPeriod && `Dönem: ${EXAM_PERIODS.find(p => p.value === examPeriod)?.label || examPeriod}`].filter(Boolean).join(" · ");
        fullContent = meta + (fullContent ? `\n\n${fullContent}` : "");
      }
      if (contentType === "kaynaklar" && linkUrl.trim()) {
        const meta = `Bağlantı: ${linkUrl.trim()}\nKaynak Türü: ${RESOURCE_TYPES.find(r => r.value === resourceType)?.label || resourceType}`;
        fullContent = meta + (fullContent ? `\n\n${fullContent}` : "");
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        course_id: courseId,
        title: title.trim(),
        content: fullContent,
        content_type: contentType,
        file_url: fileUrl,
        file_name: fileName,
        is_anonymous: isAnonymous,
      });

      if (error) throw error;

      toast.success("Gönderi başarıyla oluşturuldu!");
      resetForm();
      setOpen(false);
      onCreated(contentType);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gönderi oluşturulamadı";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button size="sm" className="h-9 gap-1.5 rounded-xl">
            <Plus className="h-4 w-4" /> Yeni Gönderi
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-border/80 p-0 sm:max-w-[680px]">
        <DialogHeader className="border-b border-border/70 bg-gradient-to-b from-card to-card/95 px-5 py-4">
          <DialogTitle className="font-heading flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            Gönderi Oluştur
          </DialogTitle>
          <DialogDescription>Ders için yeni bir içerik paylaşın.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 px-5 py-4">
          <Surface variant="soft" border="subtle" radius="lg" padding="sm" className="text-[11px] text-muted-foreground">
            İçerik kalitesi ve bağlam netliği önceliklidir. Başlıkta ders bağlamı, açıklamada kapsam ve beklenti belirtin.
          </Surface>
          {/* Content Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">İçerik Türü</Label>
            {lockedContentType ? (
              <Surface variant="soft" border="subtle" radius="lg" padding="sm" className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{TYPE_CONFIG[lockedContentType].label}</span>
                <span className="text-[11px] font-medium text-muted-foreground">Sekmeye sabit içerik türü</span>
              </Surface>
            ) : (
              <Select
                value={contentType}
                onValueChange={(value) => {
                  if (isContentType(value)) setContentType(value);
                }}
              >
                <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPE_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <OptionIcon className={`h-3.5 w-3.5 ${option.iconClassName}`} />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground">{config.helperText}</p>
          </div>

          {/* Exam metadata */}
          {config.showExamMeta && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Sınav Yılı</Label>
                <Input
                  value={examYear}
                  onChange={(e) => setExamYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="Örn: 2024"
                  maxLength={4}
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Dönem</Label>
                <Select value={examPeriod} onValueChange={setExamPeriod}>
                  <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXAM_PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Resource type */}
          {config.showResourceType && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kaynak Türü</Label>
              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Link URL */}
          {config.showLink && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <LinkIcon className="h-3 w-3" /> Bağlantı (URL)
              </Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." type="url" className="h-9 rounded-xl text-sm" />
              <p className="text-[11px] text-muted-foreground">Kaynak web sayfası, video veya doküman bağlantısı.</p>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Başlık <span className="text-destructive">*</span></Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={config.titlePlaceholder} required maxLength={200} className="h-10 rounded-xl text-sm" />
            <p className="text-[11px] text-muted-foreground flex justify-between">
              <span>Açıklayıcı bir başlık yazın.</span>
              <span className={title.length > 180 ? "text-destructive" : ""}>{title.length}/200</span>
            </p>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{config.contentLabel}</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={config.contentPlaceholder} rows={4} maxLength={5000} className="rounded-xl text-sm" />
            <p className="text-[11px] text-muted-foreground text-right">
              <span className={content.length > 4800 ? "text-destructive" : ""}>{content.length}/5000</span>
            </p>
          </div>

          {/* File upload - now supports all types */}
          {config.showFile && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Dosya Ekle (isteğe bağlı)</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl gap-1.5 text-xs" onClick={() => document.getElementById("file-upload-dialog")?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {file ? "Değiştir" : "Dosya Seç"}
                </Button>
                {file && (
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-secondary px-2 py-1 text-xs">
                    <FileText className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate">{file.name}</span>
                    <span className="text-muted-foreground shrink-0">({formatFileSize(file.size)})</span>
                    <button type="button" onClick={() => setFile(null)} className="shrink-0 text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <input
                id="file-upload-dialog"
                type="file"
                accept={ALLOWED_EXTENSIONS.join(",")}
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
              <p className="text-[11px] text-muted-foreground">
                Maksimum 50 MB. Desteklenen: PDF, Word, PowerPoint, Excel, TXT, ZIP, RAR, görseller.
              </p>
            </div>
          )}

          {/* Anonymous */}
          <div className="flex items-center gap-2 border-t border-border/70 pt-1">
            <Checkbox id="anonymous-create" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
            <label htmlFor="anonymous-create" className="text-sm text-muted-foreground cursor-pointer">
              Anonim olarak paylaş
            </label>
          </div>

          {/* Submit */}
          <Button type="submit" className="h-10 w-full rounded-xl" disabled={loading || !title.trim()}>
            {loading ? "Gönderiliyor..." : "Gönder"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

