import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Clock, FileText, ClipboardList, MessageSquare, BookMarked } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

interface RecentItem {
  id: string;
  title: string;
  content_type: string;
  created_at: string;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  notes: { label: "Not", icon: FileText, color: "bg-notes/10 text-notes" },
  past_exams: { label: "Çıkmış", icon: ClipboardList, color: "bg-primary/10 text-primary" },
  discussion: { label: "Tartışma", icon: MessageSquare, color: "bg-accent/10 text-accent" },
  kaynaklar: { label: "Kaynak", icon: BookMarked, color: "bg-kaynaklar/10 text-kaynaklar" },
};

interface RecentContentProps {
  courseId: string;
}

export default function RecentContent({ courseId }: RecentContentProps) {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => { fetchRecent(); }, [courseId]);

  const fetchRecent = async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, content_type, created_at")
      .eq("course_id", courseId)
      .order("created_at", { ascending: false })
      .limit(5);
    setItems((data as RecentItem[]) || []);
  };

  if (items.length === 0) return null;

  return (
    <Card className="p-3 border shadow-sm">
      <h3 className="font-heading text-xs font-bold flex items-center gap-1.5 mb-2">
        <Clock className="h-3.5 w-3.5 text-primary" />
        Son Eklenenler
      </h3>
      <div className="space-y-0.5">
        {items.map((item) => {
          const config = typeConfig[item.content_type] || typeConfig.notes;
          const Icon = config.icon;
          return (
            <Link
              key={item.id}
              to={`/post/${item.id}`}
              className="flex items-center gap-2 py-1.5 px-1.5 rounded-md hover:bg-secondary/50 transition-colors"
            >
              <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${config.color}`}>
                <Icon className="h-2.5 w-2.5" />
              </div>
              <p className="text-[11px] font-medium line-clamp-1 flex-1 min-w-0">{item.title}</p>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
