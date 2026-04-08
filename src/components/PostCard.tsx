import { useState, useEffect, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Surface } from "@/components/ui/surface";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { ChevronUp, ChevronDown, FileText, MessageCircle, EyeOff, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import BookmarkButton from "@/components/BookmarkButton";
import ReportDialog from "@/components/ReportDialog";
import { getFileTypeLabel } from "@/lib/content-renderer";
import type { Tables } from "@/integrations/supabase/types";

interface PostCardProps {
  post: Tables<"posts"> & { profiles?: Tables<"profiles"> | null; is_anonymous?: boolean; download_count?: number; comment_count?: number };
  onVoted?: () => void;
  showAdminActions?: boolean;
}

const typeBadgeClass: Record<string, string> = {
  notes: "content-badge-notes",
  past_exams: "content-badge-exams",
  discussion: "content-badge-discussion",
  kaynaklar: "content-badge-kaynaklar",
};

const typeLabels: Record<string, string> = {
  notes: "Notlar",
  past_exams: "Çıkmış Sorular",
  discussion: "Tartışma",
  kaynaklar: "Kaynaklar",
};

export default function PostCard({ post, onVoted, showAdminActions }: PostCardProps) {
  const { user, isAdmin } = useAuth();
  const [voting, setVoting] = useState(false);
  const [userVote, setUserVote] = useState<number>(0);
  const [localHelpful, setLocalHelpful] = useState(post.helpful_count ?? 0);

  useEffect(() => { setLocalHelpful(post.helpful_count ?? 0); }, [post.helpful_count]);
  useEffect(() => { if (user) checkUserVote(); }, [user, post.id]);

  const checkUserVote = async () => {
    if (!user) return;
    const { data } = await supabase.from("votes").select("vote_type").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
    setUserVote(data ? (data as any).vote_type : 0);
  };

  const handleVote = useCallback(async (e: React.MouseEvent, direction: 1 | -1) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast.error("Oy vermek için giriş yapmalısınız"); return; }
    if (voting) return;
    setVoting(true);
    try {
      const { data, error } = await supabase.rpc("handle_vote", { p_post_id: post.id, p_user_id: user.id, p_direction: direction });
      if (error) throw error;
      const result = data as any;
      setLocalHelpful(result.helpful_count);
      setUserVote(result.user_vote);
      onVoted?.();
    } catch { toast.error("Bir hata oluştu"); }
    setVoting(false);
  }, [user, post.id, voting, onVoted]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (post.file_url) {
      try { await supabase.rpc("increment_download_count", { post_id_input: post.id }); } catch {}
      window.open(post.file_url, "_blank");
      onVoted?.();
    }
  };

  const handleAdminDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm("Bu gönderiyi silmek istediğinizden emin misiniz?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error("Silinemedi");
    else { toast.success("Gönderi silindi"); onVoted?.(); }
  };

  const displayName = (post as any).is_anonymous ? "Anonim" : (post.profiles?.username || "Anonim");
  const downloadCount = (post as any).download_count ?? 0;
  const commentCount = (post as any).comment_count ?? 0;
  const canShowProfile = !(post as any).is_anonymous && post.profiles?.user_id;
  const fileName = (post as any).file_name || "Dosya";
  const fileLabel = getFileTypeLabel(fileName);
  const metaItems = [
    ...(post.profiles?.university ? [{ kind: "university" as const, label: "Üniversite", value: post.profiles.university, emphasis: "subtle" as const }] : []),
    ...(post.profiles?.department ? [{ kind: "department" as const, label: "Bölüm", value: post.profiles.department, emphasis: "subtle" as const }] : []),
    ...(post.content_type ? [{ kind: "contentType" as const, label: "İçerik", value: typeLabels[post.content_type], emphasis: "subtle" as const }] : []),
  ];

  return (
    <Link to={`/post/${post.id}`}>
      <Surface
        className="cursor-pointer overflow-hidden transition-all duration-200 hover:border-primary/25"
        variant="raised"
        border="default"
        padding="none"
        radius="xl"
      >
        <div className="p-3.5 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="flex min-w-[40px] flex-col items-center gap-0.5 rounded-lg border border-border/60 bg-secondary/35 px-1 py-1.5 pt-0.5">
              <button onClick={(e) => handleVote(e, 1)} disabled={voting}
                className={`p-1 rounded-lg transition-all ${userVote === 1 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5"} ${voting ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-label="Yukarı oy"><ChevronUp className="h-5 w-5" strokeWidth={2.5} /></button>
              <span className={`text-sm font-bold py-0.5 ${localHelpful > 0 ? "text-primary" : localHelpful < 0 ? "text-destructive" : "text-muted-foreground"}`}>{localHelpful}</span>
              <button onClick={(e) => handleVote(e, -1)} disabled={voting}
                className={`p-1 rounded-lg transition-all ${userVote === -1 ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/5"} ${voting ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-label="Aşağı oy"><ChevronDown className="h-5 w-5" strokeWidth={2.5} /></button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${typeBadgeClass[post.content_type]}`}>{typeLabels[post.content_type]}</span>
                {post.file_url && (
                  <span className="flex items-center gap-1 rounded-md border border-border/60 bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    <FileText className="h-3 w-3" /> {fileLabel}
                  </span>
                )}
                {(post as any).is_anonymous && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                {isAdmin && showAdminActions && (
                  <button onClick={handleAdminDelete} className="ml-auto text-muted-foreground hover:text-destructive transition-colors" aria-label="Sil">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <h3 className="mb-1.5 line-clamp-2 font-heading text-sm font-bold leading-snug text-foreground sm:text-base">{post.title}</h3>
              {metaItems.length > 0 && (
                <AcademicMeta
                  items={metaItems}
                  size="sm"
                  tone="muted"
                  className="mb-2"
                />
              )}
              {post.content && <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{post.content}</p>}

              {post.file_url && (
                <button onClick={handleDownload} className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/80">
                  <Download className="h-3.5 w-3.5" />
                  {fileName}
                  {downloadCount > 0 && <span className="text-[10px] text-muted-foreground font-normal ml-1">({downloadCount})</span>}
                </button>
              )}

              <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                {canShowProfile ? (
                  <Link to={`/user/${post.profiles!.user_id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary transition-colors">{displayName}</Link>
                ) : (
                  <span className="font-medium">{displayName}</span>
                )}
                <span>·</span>
                <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}</span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {commentCount > 0 ? `${commentCount} Yorum` : "Yorum Yap"}
                  </span>
                  <BookmarkButton postId={post.id} />
                  {user && (
                    <span onClick={(e) => e.preventDefault()}>
                      <ReportDialog targetType="post" targetId={post.id} />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </Link>
  );
}
