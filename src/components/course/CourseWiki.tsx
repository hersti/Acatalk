import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Surface } from "@/components/ui/surface";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookOpen, GraduationCap, ClipboardList, BarChart3, Lightbulb, History, Pencil, ChevronDown, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

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

type WikiFieldKey = keyof Omit<WikiData, "id">;
type WikiRow = Tables<"course_wikis">;

const emptyWiki: WikiData = {
  description: "",
  teaching_style: "",
  exam_system: "",
  difficulty_comment: "",
  recommended_sources: "",
  important_topics: "",
  past_years_info: "",
};

const FIELDS: Array<{ key: WikiFieldKey; label: string; icon: typeof BookOpen; placeholder: string }> = [
  { key: "description", label: "Ders Özeti", icon: BookOpen, placeholder: "Bu dersin kapsamını kısa ve net şekilde açıklayın." },
  { key: "teaching_style", label: "Dersin İşlenişi", icon: GraduationCap, placeholder: "Ders teorik, uygulamalı veya proje ağırlıklı mı?" },
  { key: "exam_system", label: "Sınav Sistemi", icon: ClipboardList, placeholder: "Vize, final, ödev ve değerlendirme yapısı." },
  { key: "difficulty_comment", label: "Zorluk Notu", icon: BarChart3, placeholder: "Derse hazırlıkta zorlayan noktalar nelerdir?" },
  { key: "recommended_sources", label: "Kaynak Önerileri", icon: Lightbulb, placeholder: "Kitap, video ve not kaynakları." },
  { key: "important_topics", label: "Önemli Konular", icon: BookOpen, placeholder: "Sınavlarda tekrar eden kritik başlıklar." },
  { key: "past_years_info", label: "Geçmiş Dönem Notları", icon: History, placeholder: "Önceki dönemlerden faydalı tavsiyeler." },
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
  const [open, setOpen] = useState(true);

  const toWikiData = (row: WikiRow): WikiData => ({
    id: row.id,
    description: row.description ?? "",
    teaching_style: row.teaching_style ?? "",
    exam_system: row.exam_system ?? "",
    difficulty_comment: row.difficulty_comment ?? "",
    recommended_sources: row.recommended_sources ?? "",
    important_topics: row.important_topics ?? "",
    past_years_info: row.past_years_info ?? "",
  });

  const fetchWiki = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("course_wikis").select("*").eq("course_id", courseId).maybeSingle();

    if (data) {
      const next = toWikiData(data);
      setWiki({ ...next });
      setDraft({ ...next });
    } else {
      setWiki(emptyWiki);
      setDraft(emptyWiki);
    }
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    void fetchWiki();
  }, [fetchWiki]);

  const hasContent = FIELDS.some((field) => wiki[field.key].trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      if (wiki.id) {
        const payload: TablesUpdate<"course_wikis"> = {
          description: draft.description,
          teaching_style: draft.teaching_style,
          exam_system: draft.exam_system,
          difficulty_comment: draft.difficulty_comment,
          recommended_sources: draft.recommended_sources,
          important_topics: draft.important_topics,
          past_years_info: draft.past_years_info,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from("course_wikis").update(payload).eq("id", wiki.id);
        if (error) throw error;
      } else {
        const payload: TablesInsert<"course_wikis"> = {
          course_id: courseId,
          description: draft.description,
          teaching_style: draft.teaching_style,
          exam_system: draft.exam_system,
          difficulty_comment: draft.difficulty_comment,
          recommended_sources: draft.recommended_sources,
          important_topics: draft.important_topics,
          past_years_info: draft.past_years_info,
        };
        const { error } = await supabase.from("course_wikis").insert(payload);
        if (error) throw error;
      }
      toast.success("Ders wiki güncellendi.");
      setEditing(false);
      void fetchWiki();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Wiki kaydedilemedi.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Surface variant="base" border="subtle" padding="none" radius="lg" className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 text-left transition-colors hover:bg-secondary/30">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold">Ders Wiki</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {hasContent ? "Yaşayan ders özeti ve çalışma rehberi" : "Dersin özet rehberi oluşturulmayı bekliyor"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && !editing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={(event) => {
                      event.stopPropagation();
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
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4 pt-2">
            {editing ? (
              <div className="mt-2 space-y-4">
                {FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold">
                      <field.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {field.label}
                    </Label>
                    <Textarea
                      value={draft[field.key]}
                      onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                      placeholder={field.placeholder}
                      rows={3}
                      className="text-sm"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <Button size="sm" className="gap-1.5 text-xs" onClick={handleSave} disabled={saving}>
                    <Save className="h-3 w-3" /> {saving ? "Kaydediliyor..." : "Kaydet"}
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setEditing(false)}>
                    <X className="h-3 w-3" /> İptal
                  </Button>
                </div>
              </div>
            ) : hasContent ? (
              <div className="mt-2 space-y-4">
                {FIELDS.map((field) => {
                  const value = wiki[field.key].trim();
                  if (!value) return null;
                  return (
                    <div key={field.key}>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <field.icon className="h-3.5 w-3.5 text-primary" />
                        <h4 className="text-xs font-bold text-foreground">{field.label}</h4>
                      </div>
                      <p className="pl-5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{value}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Bu alanı ders özeti, sınav sistemi ve çalışma yaklaşımı için kısa bir rehber olarak kullanabilirsiniz.
                </p>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setDraft(emptyWiki);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" /> Wiki İçeriği Ekle
                  </Button>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Surface>
    </Collapsible>
  );
}
