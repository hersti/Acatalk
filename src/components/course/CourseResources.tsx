import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Surface } from "@/components/ui/surface";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExternalLink, Book, Youtube, FileText, Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type Resource = Tables<"course_resources">;

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  book: { label: "Kitap", icon: Book, color: "bg-kaynaklar/10 text-kaynaklar" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-destructive/10 text-destructive" },
  pdf: { label: "PDF", icon: FileText, color: "bg-primary/10 text-primary" },
  website: { label: "Web Sitesi", icon: Globe, color: "bg-notes/10 text-notes" },
};

interface CourseResourcesProps {
  courseId: string;
}

export default function CourseResources({ courseId }: CourseResourcesProps) {
  const { user, isAdmin } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [resourceType, setResourceType] = useState("website");
  const [saving, setSaving] = useState(false);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_resources")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    setResources(data || []);
    setLoading(false);
  }, [courseId]);

  useEffect(() => {
    void fetchResources();
  }, [fetchResources]);

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload: TablesInsert<"course_resources"> = {
        course_id: courseId,
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        resource_type: resourceType,
        created_by: user?.id,
      };
      const { error } = await supabase.from("course_resources").insert(payload);
      if (error) throw error;
      toast.success("Kaynak eklendi.");
      setTitle("");
      setDescription("");
      setUrl("");
      setResourceType("website");
      setOpen(false);
      void fetchResources();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Kaynak eklenemedi.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("course_resources").delete().eq("id", id);
    if (error) {
      toast.error("Kaynak silinemedi.");
    } else {
      void fetchResources();
    }
  };

  if (loading) return null;

  return (
    <Surface variant="base" border="subtle" padding="sm" radius="lg">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-heading flex items-center gap-1.5 text-xs font-bold">
          <Book className="h-3.5 w-3.5 text-accent" />
          Önerilen Kaynaklar
        </h3>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]">
                <Plus className="h-3 w-3" /> Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Kaynak Ekle</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Bu ders için önerilen bir kaynak ekleyin.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tür</Label>
                  <Select value={resourceType} onValueChange={setResourceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeConfig).map(([key, value]) => (
                        <SelectItem key={key} value={key}>
                          {value.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Başlık</Label>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Kaynak adı..." maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Açıklama</Label>
                  <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Kısa açıklama..." maxLength={500} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bağlantı</Label>
                  <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
                </div>
                <Button className="w-full text-xs" onClick={handleAdd} disabled={saving || !title.trim()}>
                  {saving ? "Ekleniyor..." : "Kaynak Ekle"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {resources.length === 0 ? (
        <div className="space-y-1.5 py-1">
          <p className="text-center text-[11px] text-muted-foreground">Henüz kaynak önerisi yok.</p>
          <p className="text-center text-[10px] text-muted-foreground">
            Ders wiki ve tartışma sekmeleri, kaynak havuzunu zenginleştirmek için iyi başlangıç noktalarıdır.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {resources.map((resource) => {
            const config = typeConfig[resource.resource_type] || typeConfig.website;
            const Icon = config.icon;
            return (
              <div key={resource.id} className="group flex items-center gap-2 rounded-md bg-secondary/30 p-1.5 transition-colors hover:bg-secondary/50">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${config.color}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-xs font-medium">{resource.title}</p>
                    {resource.url && (
                      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:text-primary/80">
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                  {resource.description ? <p className="line-clamp-1 text-[10px] text-muted-foreground">{resource.description}</p> : null}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 shrink-0 p-0 text-destructive opacity-0 group-hover:opacity-100"
                    onClick={() => handleDelete(resource.id)}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
