import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ExternalLink, Book, Youtube, FileText, Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  resource_type: string;
  created_at: string;
}

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

  useEffect(() => { fetchResources(); }, [courseId]);

  const fetchResources = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("course_resources" as any)
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });
    setResources((data as any[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("course_resources" as any).insert({
        course_id: courseId,
        title: title.trim(),
        description: description.trim() || null,
        url: url.trim() || null,
        resource_type: resourceType,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success("Kaynak eklendi!");
      setTitle(""); setDescription(""); setUrl(""); setResourceType("website");
      setOpen(false);
      fetchResources();
    } catch (err: any) {
      toast.error(err.message || "Eklenemedi");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("course_resources" as any).delete().eq("id", id);
    if (error) toast.error("Silinemedi");
    else fetchResources();
  };

  if (loading) return null;
  if (resources.length === 0 && !isAdmin) return null;

  return (
    <Card className="p-3 border shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-heading text-xs font-bold flex items-center gap-1.5">
          <Book className="h-3.5 w-3.5 text-accent" />
          Önerilen Kaynaklar
        </h3>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-1.5">
                <Plus className="h-3 w-3" /> Ekle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading">Kaynak Ekle</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">Bu ders için önerilen kaynak ekleyin.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tür</Label>
                  <Select value={resourceType} onValueChange={setResourceType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Başlık</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Kaynak adı..." maxLength={200} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Açıklama</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kısa açıklama..." maxLength={500} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Link</Label>
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
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
        <p className="text-[11px] text-muted-foreground text-center py-3">Henüz kaynak eklenmemiş.</p>
      ) : (
        <div className="space-y-1">
          {resources.map((r) => {
            const config = typeConfig[r.resource_type] || typeConfig.website;
            const Icon = config.icon;
            return (
              <div key={r.id} className="flex items-center gap-2 p-1.5 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                <div className={`h-6 w-6 rounded-md flex items-center justify-center shrink-0 ${config.color}`}>
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium truncate">{r.title}</p>
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0">
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
