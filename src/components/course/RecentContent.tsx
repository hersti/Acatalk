import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Surface } from "@/components/ui/surface";
import { Clock, FileText, ClipboardList, MessageSquare, BookMarked } from "lucide-react";
import { buildPostDetailHref, resolveCourseTabFromContentType } from "@/lib/course-navigation";
import { isAcademicContentType } from "@/lib/academic-content";

interface RecentItem {
  id: string;
  title: string;
  content_type: string;
  created_at: string;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  notes: { label: "Not", icon: FileText, color: "bg-notes/10 text-notes" },
  past_exams: { label: "Geçmiş Sınav", icon: ClipboardList, color: "bg-primary/10 text-primary" },
  discussion: { label: "Tartışma", icon: MessageSquare, color: "bg-accent/10 text-accent" },
  kaynaklar: { label: "Kaynak", icon: BookMarked, color: "bg-kaynaklar/10 text-kaynaklar" },
};

interface RecentContentProps {
  courseId: string;
}

export default function RecentContent({ courseId }: RecentContentProps) {
  const [items, setItems] = useState<RecentItem[]>([]);

  const fetchRecent = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, content_type, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(5);
    setItems((data as RecentItem[]) || []);
  }, [courseId]);

  useEffect(() => {
    void fetchRecent();
  }, [fetchRecent]);

  return (
    <Surface variant="base" border="subtle" padding="sm" radius="lg">
      <h3 className="mb-2 flex items-center gap-1.5 font-heading text-xs font-bold">
        <Clock className="h-3.5 w-3.5 text-primary" />
        Son Eklenenler
      </h3>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Henüz yeni içerik yok. İlk not, çıkmış soru veya kaynak paylaşımı bu alanı canlandırır.
        </p>
      ) : (
        <div className="space-y-0.5">
          {items.map((item) => {
            const config = typeConfig[item.content_type] || typeConfig.notes;
            const Icon = config.icon;
            const itemTab = isAcademicContentType(item.content_type)
              ? resolveCourseTabFromContentType(item.content_type)
              : "overview";
            return (
              <Link
                key={item.id}
                to={buildPostDetailHref(item.id, {
                  courseId,
                  tab: itemTab,
                })}
                className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-secondary/50"
              >
                <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${config.color}`}>
                  <Icon className="h-2.5 w-2.5" />
                </div>
                <p className="line-clamp-1 min-w-0 flex-1 text-[11px] font-medium">{item.title}</p>
                <span className="shrink-0 text-[9px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
