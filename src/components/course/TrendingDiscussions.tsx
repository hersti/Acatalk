import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp, MessageSquare, ChevronUp, CheckCircle2 } from "lucide-react";

interface TrendingPost {
  id: string;
  title: string;
  helpful_count: number;
  comment_count: number;
  is_solved: boolean;
  created_at: string;
}

interface TrendingDiscussionsProps {
  courseId: string;
  onSelect: (id: string) => void;
}

export default function TrendingDiscussions({ courseId, onSelect }: TrendingDiscussionsProps) {
  const [posts, setPosts] = useState<TrendingPost[]>([]);

  const fetchTrending = useCallback(async () => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, helpful_count, comment_count, is_solved, created_at")
      .eq("course_id", courseId)
      .eq("content_type", "discussion")
      .order("helpful_count", { ascending: false })
      .limit(5);
    setPosts((data as TrendingPost[]) || []);
  }, [courseId]);

  useEffect(() => {
    void fetchTrending();
  }, [fetchTrending]);

  return (
    <Card className="p-3 border shadow-sm">
      <h3 className="font-heading text-xs font-bold flex items-center gap-1.5 mb-2">
        <TrendingUp className="h-3.5 w-3.5 text-accent" />
        Populer Tartismalar
      </h3>
      {posts.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Henuz one cikan tartisma yok. Dersle ilgili ilk soruyu acarak akademik diyalogu baslatabilirsiniz.
        </p>
      ) : (
        <div className="space-y-0.5">
          {posts.map((post, index) => (
            <button
              key={post.id}
              onClick={() => onSelect(post.id)}
              className="w-full text-left flex items-center gap-2 py-1.5 px-1.5 rounded-md hover:bg-secondary/50 transition-colors"
            >
              <span className="text-[10px] font-bold text-muted-foreground w-3 shrink-0">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium line-clamp-1">{post.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <ChevronUp className="h-2 w-2" /> {post.helpful_count ?? 0}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-2 w-2" /> {post.comment_count ?? 0}
                  </span>
                  {post.is_solved && (
                    <span className="flex items-center gap-0.5 text-success">
                      <CheckCircle2 className="h-2 w-2" /> Cozuldu
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
