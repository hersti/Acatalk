import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import MentionInput from "@/components/MentionInput";
import { RenderMentions } from "@/components/MentionRenderer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, ChevronUp, ChevronDown, CheckCircle2, Pin,
  EyeOff, Heart, Reply, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import ReportDialog from "@/components/ReportDialog";
import type { DiscussionPost } from "./DiscussionPanel";

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_anonymous: boolean;
  created_at: string;
  like_count: number;
  username?: string;
  userLiked?: boolean;
}

interface DiscussionDetailProps {
  post: DiscussionPost;
  onBack: () => void;
  onRefresh: () => void;
}

const typeLabels: Record<string, string> = {
  soru: "Soru",
  sinav: "Sınav Konuşması",
  kaynak: "Kaynak Önerisi",
  hoca: "Hoca / İşleniş Yorumu",
  not_sorusu: "Not Hakkında Soru",
};

export default function DiscussionDetail({ post, onBack, onRefresh }: DiscussionDetailProps) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userVote, setUserVote] = useState(0);
  const [localHelpful, setLocalHelpful] = useState(post.helpful_count ?? 0);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    setLocalHelpful(post.helpful_count ?? 0);
  }, [post.helpful_count]);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

      let userLikes = new Set<string>();
      if (user) {
        const commentIds = data.map((c: any) => c.id);
        const { data: likes } = await supabase.from("comment_likes").select("comment_id").eq("user_id", user.id).in("comment_id", commentIds);
        if (likes) userLikes = new Set(likes.map((l: any) => l.comment_id));
      }

      setComments(
        data.map((c: any) => ({
          ...c,
          username: c.is_anonymous ? "Anonim" : (profileMap.get(c.user_id) || "Anonim"),
          userLiked: userLikes.has(c.id),
        }))
      );
    } else {
      setComments([]);
    }
  }, [post.id, user]);

  const checkUserVote = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("votes").select("vote_type").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
    setUserVote(data ? (data as any).vote_type : 0);
  }, [post.id, user]);

  useEffect(() => {
    setComments([]);
    setContent("");
    setIsAnonymous(false);
    setReplyTo(null);
    setUserVote(0);
    setVoting(false);
    setLoading(false);
    void fetchComments();
    if (user) void checkUserVote();
  }, [checkUserVote, fetchComments, post.id, user]);

  const handleVote = async (direction: 1 | -1) => {
    if (!user) { toast.error("Giriş yapmalısınız"); return; }
    if (voting) return;
    setVoting(true);
    try {
      const { data, error } = await supabase.rpc("handle_vote", { p_post_id: post.id, p_user_id: user.id, p_direction: direction });
      if (error) throw error;
      const result = data as any;
      setLocalHelpful(result.helpful_count);
      setUserVote(result.user_vote);
      onRefresh();
    } catch { toast.error("Bir hata oluştu"); }
    setVoting(false);
  };

  const handleSubmit = async () => {
    if (!user || !content.trim() || loading) return;
    setLoading(true);
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      user_id: user.id,
      content: content.trim(),
      is_anonymous: isAnonymous,
      parent_id: replyTo,
    });
    if (error) toast.error(error.message);
    else {
      setContent("");
      setReplyTo(null);
      setIsAnonymous(false);
      fetchComments();
      onRefresh();
    }
    setLoading(false);
  };

  const handleLike = async (commentId: string, isLiked: boolean) => {
    if (!user) { toast.error("Giriş yapmalısınız"); return; }
    try {
      if (isLiked) {
        await supabase.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", commentId);
        await supabase.rpc("decrement_comment_like", { comment_id_input: commentId });
      } else {
        await supabase.from("comment_likes").insert({ user_id: user.id, comment_id: commentId } as any);
        await supabase.rpc("increment_comment_like", { comment_id_input: commentId });
      }
      fetchComments();
    } catch { toast.error("Bir hata oluştu"); }
  };

  const handleMarkSolved = async (commentId: string) => {
    if (!user || user.id !== post.user_id) return;
    const { error } = await supabase.from("posts").update({ is_solved: true, solved_comment_id: commentId } as any).eq("id", post.id);
    if (error) toast.error("İşaretlenemedi");
    else { toast.success("Çözüldü olarak işaretlendi"); onRefresh(); }
  };

  const handleTogglePin = async () => {
    const newVal = !(post as any).is_pinned;
    const { error } = await supabase.from("posts").update({ is_pinned: newVal } as any).eq("id", post.id);
    if (error) toast.error("İşlem başarısız");
    else { toast.success(newVal ? "Sabitlendi" : "Sabitleme kaldırıldı"); onRefresh(); }
  };

  const handleDeleteDiscussion = async () => {
    if (!confirm("Bu tartışmayı silmek istediğinizden emin misiniz? Tüm yanıtlar da silinecek.")) return;
    // Delete all comments first, then the post
    await supabase.from("comments").delete().eq("post_id", post.id);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error("Silinemedi: " + error.message);
    else {
      toast.success("Tartışma silindi");
      onBack();
      onRefresh();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Bu yanıtı silmek istediğinizden emin misiniz?")) return;
    // Delete child replies first
    await supabase.from("comments").delete().eq("parent_id", commentId);
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) toast.error("Silinemedi: " + error.message);
    else {
      toast.success("Yanıt silindi");
      fetchComments();
      onRefresh();
    }
  };

  const displayName = post.is_anonymous ? "Anonim" : (post.profiles?.username || "Anonim");
  const dt = post.discussion_type;
  const solved = post.is_solved;
  const solvedCommentId = post.solved_comment_id;
  const pinned = post.is_pinned;

  const topLevel = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 rounded-md hover:bg-secondary">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 flex-wrap flex-1">
            {pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
            {solved && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
            {dt && typeLabels[dt] && (
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                {typeLabels[dt]}
              </span>
            )}
          </div>
          {/* Admin controls */}
          {isAdmin && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleTogglePin}>
                <Pin className="h-3 w-3" /> {pinned ? "Kaldır" : "Sabitle"}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleDeleteDiscussion}>
                <Trash2 className="h-3 w-3" /> Sil
              </Button>
            </div>
          )}
          {/* Owner can also delete own discussion */}
          {!isAdmin && user?.id === post.user_id && (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleDeleteDiscussion}>
              <Trash2 className="h-3 w-3" /> Sil
            </Button>
          )}
        </div>
        <h2 className="font-heading text-lg font-bold leading-snug">{post.title}</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            {post.is_anonymous && <EyeOff className="h-3 w-3" />}
            {displayName}
          </span>
          <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}</span>
        </div>
      </div>

      {/* Content + Vote */}
      <div className="flex border-b">
        <div className="flex flex-col items-center gap-0.5 p-3 border-r bg-secondary/20">
          <button onClick={() => handleVote(1)} disabled={voting}
            className={`p-1 rounded-md transition-all ${userVote === 1 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"} ${voting ? "opacity-50 cursor-not-allowed" : ""}`}>
            <ChevronUp className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <span className={`text-sm font-bold ${localHelpful > 0 ? "text-primary" : localHelpful < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {localHelpful}
          </span>
          <button onClick={() => handleVote(-1)} disabled={voting}
            className={`p-1 rounded-md transition-all ${userVote === -1 ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-destructive"} ${voting ? "opacity-50 cursor-not-allowed" : ""}`}>
            <ChevronDown className="h-5 w-5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex-1 p-4">
          {post.content && <p className="text-sm leading-relaxed whitespace-pre-wrap"><RenderMentions text={post.content} /></p>}
          {!post.content && <p className="text-sm text-muted-foreground italic">İçerik yok.</p>}
        </div>
      </div>

      {/* Comments */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Yanıtlar ({comments.length})
          </h3>
          {topLevel.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">Henüz yanıt yok.</p>
          )}
          {topLevel.map((comment) => (
            <div key={comment.id} className="space-y-1.5">
              <CommentItem
                comment={comment}
                isSolvedAnswer={solvedCommentId === comment.id}
                canMarkSolved={!solved && user?.id === post.user_id}
                onMarkSolved={handleMarkSolved}
                onLike={handleLike}
                onReply={(id) => setReplyTo(replyTo === id ? null : id)}
                onDelete={isAdmin || user?.id === comment.user_id ? handleDeleteComment : undefined}
                replyTo={replyTo}
                isAdmin={isAdmin}
              />
              {getReplies(comment.id).map((reply) => (
                <div key={reply.id} className="ml-6">
                  <CommentItem
                    comment={reply}
                    isSolvedAnswer={false}
                    canMarkSolved={false}
                    onMarkSolved={handleMarkSolved}
                    onLike={handleLike}
                    onReply={() => {}}
                    onDelete={isAdmin || user?.id === reply.user_id ? handleDeleteComment : undefined}
                    replyTo={null}
                    isReply
                    isAdmin={isAdmin}
                  />
                </div>
              ))}
              {replyTo === comment.id && user && (
                <div className="ml-6 space-y-2">
                  <MentionInput value={content} onChange={setContent} placeholder="Yanıtınızı yazın..." rows={2} className="text-sm" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`anon-r-${comment.id}`} checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
                      <label htmlFor={`anon-r-${comment.id}`} className="text-xs text-muted-foreground">Anonim</label>
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={loading || !content.trim()}>
                      {loading ? "..." : "Yanıtla"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Reply input (top-level) */}
      {user && !replyTo && (
        <div className="p-3 border-t bg-secondary/10 space-y-2">
          <MentionInput value={content} onChange={setContent} placeholder="Yanıt yazın..." rows={2} className="text-sm" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox id="anon-main" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
              <label htmlFor="anon-main" className="text-xs text-muted-foreground">Anonim</label>
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={loading || !content.trim()}>
              {loading ? "..." : "Gönder"}
            </Button>
          </div>
        </div>
      )}

      {!user && (
        <div className="p-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Yanıt yazmak için <a href="/auth" className="text-primary hover:underline font-medium">giriş yapın</a>.
          </p>
        </div>
      )}
    </div>
  );
}

// --- Comment Item ---
function CommentItem({
  comment, isSolvedAnswer, canMarkSolved, onMarkSolved, onLike, onReply, onDelete, replyTo, isReply, isAdmin,
}: {
  comment: Comment;
  isSolvedAnswer: boolean;
  canMarkSolved: boolean;
  onMarkSolved: (id: string) => void;
  onLike: (id: string, liked: boolean) => void;
  onReply: (id: string) => void;
  onDelete?: (id: string) => void;
  replyTo: string | null;
  isReply?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 ${isSolvedAnswer ? "bg-success/10 border border-success/30" : "bg-secondary/30"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold flex items-center gap-1">
          {comment.is_anonymous && <EyeOff className="h-3 w-3 text-muted-foreground" />}
          {comment.username}
          {isSolvedAnswer && (
            <span className="flex items-center gap-0.5 text-success ml-1">
              <CheckCircle2 className="h-3 w-3" /> Çözüm
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: tr })}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
              title="Yanıtı sil"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm leading-relaxed"><RenderMentions text={comment.content} /></p>
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={() => onLike(comment.id, !!comment.userLiked)}
          className={`flex items-center gap-1 text-xs transition-colors ${
            comment.userLiked ? "text-destructive" : "text-muted-foreground hover:text-destructive"
          }`}
        >
          <Heart className={`h-3 w-3 ${comment.userLiked ? "fill-current" : ""}`} />
          {comment.like_count > 0 && <span>{comment.like_count}</span>}
        </button>
        {!isReply && (
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <Reply className="h-3 w-3" /> Yanıtla
          </button>
        )}
        {canMarkSolved && !isSolvedAnswer && (
          <button
            onClick={() => onMarkSolved(comment.id)}
            className="text-xs text-success hover:text-success/80 transition-colors flex items-center gap-1 ml-auto"
          >
            <CheckCircle2 className="h-3 w-3" /> Çözüldü İşaretle
          </button>
        )}
        <span className="ml-auto">
          <ReportDialog targetType="comment" targetId={comment.id} />
        </span>
      </div>
    </div>
  );
}
