import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  BookOpen, GraduationCap, ClipboardList, BarChart3,
  Lightbulb, History, Pencil, ChevronDown, Save, X,
} from "lucide-react";
import { toast } from "sonner";

interface WikiData {
  id?: string;
  description: string;
  teaching_style: string;
  exam_system: string;
  difficulty_comment: string;
  recommended_sources: string;
  important_topics: string;
  past_years_info: string;
}

const emptyWiki: WikiData = {
  description: "",
  teaching_style: "",
  exam_system: "",
  difficulty_comment: "",
  recommended_sources: "",
  important_topics: "",
  past_years_info: "",
};

const FIELDS = [
  { key: "description", label: "Ders Açıklaması", icon: BookOpen, placeholder: "Bu ders neleri kapsar?" },
  { key: "teaching_style", label: "Dersin İşlenişi", icon: GraduationCap, placeholder: "Ders nasıl işleniyor? Lab, teori, sunum vb." },
  { key: "exam_system", label: "Sınav Sistemi", icon: ClipboardList, placeholder: "Vize/Final/Ödev ağırlıkları, sınav formatı..." },
  { key: "difficulty_comment", label: "Zorluk Seviyesi", icon: BarChart3, placeholder: "Genel zorluk yorumu..." },
  { key: "recommended_sources", label: "Önerilen Kaynaklar", icon: Lightbulb, placeholder: "Kitap, video, web sitesi önerileri..." },
  { key: "important_topics", label: "Önemli Konular", icon: BookOpen, placeholder: "Sınavda çıkan veya dikkat edilmesi gereken konular..." },
  { key: "past_years_info", label: "Geçmiş Yıllar", icon: History, placeholder: "Önceki dönemlerden bilgiler, notlar..." },
] as const;

interface CourseWikiProps {
  courseId: string;
}

export default function CourseWiki({ courseId }: CourseWikiProps) {
  const { isAdmin } = useAuth();
  const [wiki, setWiki] = useState<WikiData>(emptyWiki);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WikiData>(emptyWiki);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchWiki();
  }, [courseId]);

  const fetchWiki = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_wikis" as any)
      .select("*")
      .eq("course_id", courseId)
      .maybeSingle();
    if (data) {
      const w = data as any;
      setWiki({ ...w });
      setDraft({ ...w });
    }
    setLoading(false);
  };

  const hasContent = FIELDS.some((f) => (wiki as any)[f.key]?.trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      if (wiki.id) {
        const { error } = await supabase
          .from("course_wikis" as any)
          .update({
            description: draft.description,
            teaching_style: draft.teaching_style,
            exam_system: draft.exam_system,
            difficulty_comment: draft.difficulty_comment,
            recommended_sources: draft.recommended_sources,
            important_topics: draft.important_topics,
            past_years_info: draft.past_years_info,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", wiki.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("course_wikis" as any)
          .insert({
            course_id: courseId,
            description: draft.description,
            teaching_style: draft.teaching_style,
            exam_system: draft.exam_system,
            difficulty_comment: draft.difficulty_comment,
            recommended_sources: draft.recommended_sources,
            important_topics: draft.important_topics,
            past_years_info: draft.past_years_info,
          } as any);
        if (error) throw error;
      }
      toast.success("Wiki güncellendi!");
      setEditing(false);
      fetchWiki();
    } catch (err: any) {
      toast.error(err.message || "Kaydedilemedi");
    }
    setSaving(false);
  };

  if (loading) return null;

  // If no content and not admin, don't show
  if (!hasContent && !isAdmin) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden border shadow-sm">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors text-left">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold">Ders Wiki</h3>
                <p className="text-[11px] text-muted-foreground">
                  {hasContent ? "Ders hakkında bilgiler" : "Henüz içerik eklenmemiş"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && !editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDraft({ ...wiki });
                    setEditing(true);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3" /> Düzenle
                </Button>
              )}
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-5 pb-5 pt-1 border-t">
            {editing ? (
              <div className="space-y-4 mt-3">
                {FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <field.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {field.label}
                    </Label>
                    <Textarea
                      value={(draft as any)[field.key] || ""}
                      onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                    <Save className="h-3 w-3" /> {saving ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setEditing(false)}>
                    <X className="h-3 w-3" /> İptal
                  </Button>
                </div>
              </div>
            ) : hasContent ? (
              <div className="space-y-4 mt-3">
                {FIELDS.map((field) => {
                  const val = (wiki as any)[field.key]?.trim();
                  if (!val) return null;
                  return (
                    <div key={field.key}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <field.icon className="h-3.5 w-3.5 text-primary" />
                        <h4 className="text-xs font-bold text-foreground">{field.label}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap pl-5">
                        {val}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">Henüz wiki içeriği eklenmemiş.</p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5 text-xs"
                    onClick={() => {
                      setDraft(emptyWiki);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" /> İçerik Ekle
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
