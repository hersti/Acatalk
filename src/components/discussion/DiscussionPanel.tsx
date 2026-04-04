import { useEffect, useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import DiscussionList from "./DiscussionList";
import DiscussionDetail from "./DiscussionDetail";
import CreateDiscussionDialog from "./CreateDiscussionDialog";
import type { Tables } from "@/integrations/supabase/types";

export type DiscussionPost = Tables<"posts"> & {
  profiles: Tables<"profiles"> | null;
  discussion_type?: string | null;
  is_solved?: boolean;
  is_pinned?: boolean;
  solved_comment_id?: string | null;
};

interface DiscussionPanelProps {
  courseId: string;
}

const DISCUSSION_TYPES = [
  { value: "all", label: "Tumu" },
  { value: "soru", label: "Soru" },
  { value: "sinav", label: "Sinav Konusmasi" },
  { value: "kaynak", label: "Kaynak Onerisi" },
  { value: "hoca", label: "Hoca / Islenis Yorumu" },
  { value: "not_sorusu", label: "Not Hakkinda Soru" },
];

export { DISCUSSION_TYPES };

export default function DiscussionPanel({ courseId }: DiscussionPanelProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [filterType, setFilterType] = useState("all");

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("course_id", courseId)
      .eq("content_type", "discussion")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((post) => post.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      setPosts(
        data.map((post) => ({
          ...post,
          profiles: profileMap.get(post.user_id) || null,
        })) as DiscussionPost[],
      );
    } else {
      setPosts([]);
    }
    setLoading(false);
  }, [courseId]);

  const handleCreated = useCallback(async (newPostId?: string) => {
    await fetchPosts();
    if (newPostId) setSelectedId(newPostId);
  }, [fetchPosts]);

  useEffect(() => {
    void fetchPosts();
    setSelectedId(null);
    setSearch("");
    setSort("newest");
    setFilterType("all");
  }, [courseId, fetchPosts]);

  useEffect(() => {
    const handler = (event: Event) => {
      const postId = (event as CustomEvent).detail;
      if (postId) setSelectedId(postId);
    };
    window.addEventListener("select-discussion", handler);
    return () => window.removeEventListener("select-discussion", handler);
  }, []);

  const filtered = posts
    .filter((post) => {
      if (filterType !== "all" && post.discussion_type !== filterType) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return post.title.toLowerCase().includes(query) || (post.content || "").toLowerCase().includes(query);
      }
      return true;
    })
    .sort((a, b) => {
      const aPin = a.is_pinned ? 1 : 0;
      const bPin = b.is_pinned ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;

      switch (sort) {
        case "most_voted":
          return (b.helpful_count ?? 0) - (a.helpful_count ?? 0);
        case "most_replied":
          return (b.comment_count ?? 0) - (a.comment_count ?? 0);
        case "solved":
          return (b.is_solved ? 1 : 0) - (a.is_solved ? 1 : 0);
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const selectedPost = selectedId ? posts.find((post) => post.id === selectedId) || null : null;

  useEffect(() => {
    if (selectedId && !loading && !posts.find((post) => post.id === selectedId)) {
      setSelectedId(null);
    }
  }, [posts, selectedId, loading]);

  if (isMobile) {
    if (selectedPost) {
      return <DiscussionDetail post={selectedPost} onBack={() => setSelectedId(null)} onRefresh={fetchPosts} />;
    }
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {user && <CreateDiscussionDialog courseId={courseId} onCreated={handleCreated} />}
        </div>
        <DiscussionList
          posts={filtered}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          filterType={filterType}
          onFilterChange={setFilterType}
        />
      </div>
    );
  }

  return (
    <div className="flex gap-4 min-h-[500px]">
      <div className="w-[380px] shrink-0 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          {user && <CreateDiscussionDialog courseId={courseId} onCreated={handleCreated} />}
        </div>
        <DiscussionList
          posts={filtered}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearchChange={setSearch}
          sort={sort}
          onSortChange={setSort}
          filterType={filterType}
          onFilterChange={setFilterType}
        />
      </div>

      <div className="flex-1 min-w-0">
        {selectedPost ? (
          <DiscussionDetail post={selectedPost} onBack={() => setSelectedId(null)} onRefresh={fetchPosts} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-secondary/20 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            {posts.length === 0 && !loading ? (
              <>
                <h3 className="font-heading font-bold text-base text-foreground mb-2">Henuz tartisma yok</h3>
                <p className="text-sm text-muted-foreground max-w-[300px] leading-relaxed mb-5">
                  Bu alanda kavram sorulari, sinav stratejileri ve kaynak degerlendirmeleri gibi kalici akademik tartismalar olusur.
                </p>
                {user && <CreateDiscussionDialog courseId={courseId} onCreated={handleCreated} />}
              </>
            ) : (
              <>
                <h3 className="font-heading font-semibold text-sm text-foreground mb-1">Bir tartisma secin</h3>
                <p className="text-xs text-muted-foreground max-w-[260px]">
                  Soldaki listeden bir baslik secerek detaylari goruntuleyin ve ders odakli yanit ekleyin.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
