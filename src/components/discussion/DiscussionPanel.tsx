import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import DiscussionList from "./DiscussionList";
import DiscussionDetail from "./DiscussionDetail";
import CreateDiscussionDialog from "./CreateDiscussionDialog";
import { MessageSquare } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export type DiscussionPost = Tables<"posts"> & {
  profiles: Tables<"profiles"> | null;
  discussion_type?: string | null;
  is_solved?: boolean;
  is_pinned?: boolean;
  solved_comment_id?: string | null;
};

type SortOption = "newest" | "most_voted" | "most_replied" | "solved";

interface DiscussionPanelProps {
  courseId: string;
}

const DISCUSSION_TYPES = [
  { value: "all", label: "Tümü" },
  { value: "soru", label: "Soru" },
  { value: "sinav", label: "Sınav Konuşması" },
  { value: "kaynak", label: "Kaynak Önerisi" },
  { value: "hoca", label: "Hoca / İşleniş Yorumu" },
  { value: "not_sorusu", label: "Not Hakkında Soru" },
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
      const userIds = [...new Set(data.map((p) => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);
      const newPosts = data.map((p) => ({
        ...p,
        profiles: profileMap.get(p.user_id) || null,
      })) as DiscussionPost[];
      setPosts(newPosts);
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
    fetchPosts();
    // Reset selection when course changes
    setSelectedId(null);
    setSearch("");
    setSort("newest");
    setFilterType("all");
  }, [courseId]);

  // Listen for external selection (e.g. from TrendingDiscussions)
  useEffect(() => {
    const handler = (e: Event) => {
      const postId = (e as CustomEvent).detail;
      if (postId) setSelectedId(postId);
    };
    window.addEventListener("select-discussion", handler);
    return () => window.removeEventListener("select-discussion", handler);
  }, []);

  const filtered = posts
    .filter((p) => {
      if (filterType !== "all" && p.discussion_type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || (p.content || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      // Pinned always first
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

  // CRITICAL FIX: Get selected post from the LATEST posts array
  const selectedPost = selectedId ? posts.find((p) => p.id === selectedId) || null : null;

  // If selected post was deleted or doesn't exist anymore, clear selection
  useEffect(() => {
    if (selectedId && !loading && posts.length >= 0 && !posts.find((p) => p.id === selectedId)) {
      // Only clear if we're done loading and the post genuinely doesn't exist
      if (!loading) {
        setSelectedId(null);
      }
    }
  }, [posts, selectedId, loading]);

  const handleBack = () => setSelectedId(null);

  // Mobile: show detail or list
  if (isMobile) {
    if (selectedPost) {
      return (
        <DiscussionDetail
          post={selectedPost}
          onBack={handleBack}
          onRefresh={fetchPosts}
        />
      );
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

  // Desktop: side-by-side
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
          <DiscussionDetail post={selectedPost} onBack={handleBack} onRefresh={fetchPosts} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-secondary/20 rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            {posts.length === 0 && !loading ? (
              <>
                <h3 className="font-heading font-bold text-base text-foreground mb-2">Henüz tartışma yok</h3>
                <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed mb-5">
                  Bu ders hakkında soru sorabilir, sınav hakkında konuşabilir veya kaynak paylaşabilirsiniz.
                </p>
                {user && <CreateDiscussionDialog courseId={courseId} onCreated={handleCreated} />}
              </>
            ) : (
              <>
                <h3 className="font-heading font-semibold text-sm text-foreground mb-1">Bir tartışma seçin</h3>
                <p className="text-xs text-muted-foreground max-w-[240px]">
                  Soldaki listeden bir tartışma seçerek detaylarını görüntüleyin ve yanıt yazın.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}