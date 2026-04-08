import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  postId: string;
  className?: string;
  size?: "sm" | "md";
}

export default function BookmarkButton({ postId, className, size = "sm" }: BookmarkButtonProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkBookmark = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("post_id", postId)
      .maybeSingle();
    setSaved(!!data);
  }, [postId, user]);

  useEffect(() => {
    if (user) void checkBookmark();
  }, [checkBookmark, user]);

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { toast.error("Giriş yapmalısınız"); return; }
    if (loading) return;
    setLoading(true);
    try {
      if (saved) {
        await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("post_id", postId);
        setSaved(false);
        toast.success("Kaydedilenlerden kaldırıldı");
      } else {
        await supabase.from("bookmarks").insert({ user_id: user.id, post_id: postId });
        setSaved(true);
        toast.success("Kaydedildi");
      }
    } catch {
      toast.error("Bir hata oluştu");
    }
    setLoading(false);
  }, [user, postId, saved, loading]);

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        "transition-colors",
        saved ? "text-primary" : "text-muted-foreground hover:text-primary",
        loading && "opacity-50 cursor-not-allowed",
        className
      )}
      aria-label={saved ? "Kayıttan kaldır" : "Kaydet"}
      title={saved ? "Kayıttan kaldır" : "Kaydet"}
    >
      <Bookmark className={cn(iconSize, saved && "fill-current")} />
    </button>
  );
}
