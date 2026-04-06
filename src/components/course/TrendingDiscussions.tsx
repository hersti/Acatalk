import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Surface } from "@/components/ui/surface";
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
    <Surface variant="base" border="subtle" padding="sm" radius="lg">
      <h3 className="mb-2 flex items-center gap-1.5 font-heading text-xs font-bold">
        <TrendingUp className="h-3.5 w-3.5 text-accent" />
        Popüler Tartışmalar
      </h3>
      {posts.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Henüz öne çıkan tartışma yok. Dersle ilgili ilk soruyu açarak akademik diyaloğu başlatabilirsiniz.
        </p>
      ) : (
        <div className="space-y-0.5">
          {posts.map((post, index) => (
            <button
              key={post.id}
              onClick={() => onSelect(post.id)}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-secondary/50"
            >
              <span className="w-3 shrink-0 text-[10px] font-bold text-muted-foreground">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[11px] font-medium">{post.title}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-0.5">
                    <ChevronUp className="h-2 w-2" /> {post.helpful_count ?? 0}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-2 w-2" /> {post.comment_count ?? 0}
                  </span>
                  {post.is_solved && (
                    <span className="flex items-center gap-0.5 text-success">
                      <CheckCircle2 className="h-2 w-2" /> Çözüldü
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Surface>
  );
}
