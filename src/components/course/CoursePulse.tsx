import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Activity, MessageSquare, Users, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";

interface CoursePulsePost {
  id: string;
  user_id: string;
  created_at: string;
  content_type: "notes" | "past_exams" | "discussion" | "kaynaklar";
  profiles?: { username?: string | null } | null;
}

interface CoursePulseProps {
  posts: CoursePulsePost[];
}

export default function CoursePulse({ posts }: CoursePulseProps) {
  const total = posts.length;
  const discussions = posts.filter((post) => post.content_type === "discussion").length;
  const uniqueContributors = new Set(posts.map((post) => post.user_id)).size;
  const latest = posts[0]?.created_at || null;

  const topContributors = Array.from(
    posts.reduce((map, post) => {
      const username = post.profiles?.username || "Kullanıcı";
      const current = map.get(username) || 0;
      map.set(username, current + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Card className="p-3 border shadow-sm">
      <h3 className="font-heading text-xs font-bold flex items-center gap-1.5 mb-2">
        <Activity className="h-3.5 w-3.5 text-primary" />
        Ders Nabzı
      </h3>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-md bg-secondary/40 px-2 py-1.5">
          <p className="text-muted-foreground flex items-center gap-1">
            <FileText className="h-3 w-3" /> İçerik
          </p>
          <p className="font-semibold text-foreground mt-0.5">{total}</p>
        </div>
        <div className="rounded-md bg-secondary/40 px-2 py-1.5">
          <p className="text-muted-foreground flex items-center gap-1">
            <MessageSquare className="h-3 w-3" /> Tartışma
          </p>
          <p className="font-semibold text-foreground mt-0.5">{discussions}</p>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground space-y-1">
        <p className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Aktif katkıcı: <span className="font-semibold text-foreground">{uniqueContributors}</span>
        </p>
        <p>
          Son aktivite:{" "}
          <span className="font-semibold text-foreground">
            {latest ? formatDistanceToNow(new Date(latest), { addSuffix: true, locale: tr }) : "Henüz yok"}
          </span>
        </p>
      </div>

      <div className="mt-2 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Öne çıkan katkıcılar</p>
        {topContributors.length > 0 ? (
          topContributors.map(([username, count], index) => (
            <div key={`${username}-${index}`} className="flex items-center justify-between text-[11px] rounded-md bg-secondary/30 px-2 py-1">
              <span className="truncate">{username}</span>
              <span className="font-semibold text-foreground">{count} katkı</span>
            </div>
          ))
        ) : (
          <p className="text-[11px] text-muted-foreground rounded-md bg-secondary/20 px-2 py-1.5">
            Dersin ilk katkılarını ekleyerek bu alanı canlandırın.
          </p>
        )}
      </div>
    </Card>
  );
}
