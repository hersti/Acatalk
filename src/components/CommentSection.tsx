import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Reply, EyeOff, Heart, Trash2 } from "lucide-react";
import ReportDialog from "@/components/ReportDialog";
import MentionInput, { renderMentions } from "@/components/MentionInput";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";

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

interface CommentSectionProps {
  postId: string;
}

export default function CommentSection({ postId }: CommentSectionProps) {
  const { user, isAdmin } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

      // Check which comments user has liked
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
  };

  const handleSubmit = async () => {
    if (!user || !content.trim()) return;

    // Instant client-side block
    const quickCheck = quickContentCheck(content.trim());
    if (!quickCheck.safe) {
      toast.error(quickCheck.reason || "Bu içerik platform kurallarını ihlal ediyor.");
      return;
    }

    setLoading(true);

    // Check if user is muted/suspended
    const status = await checkUserModerationStatus(user.id);
    if (!status.canPost) {
      toast.error(status.reason || "İçerik göndermeniz engellenmiştir.");
      setLoading(false);
      return;
    }

    // Check URLs for safety
    const urlCheck = checkTextUrls(content.trim());
    if (!urlCheck.safe) {
      toast.error(urlCheck.reason || "Yorumunuzdaki bir bağlantı platform kurallarını ihlal ediyor.");
      setLoading(false);
      return;
    }

    // Moderate text content
    const modResult = await moderateText(content.trim(), "comment", postId);
    if (!modResult.safe) {
      toast.error(getViolationMessage(modResult.violation_type));
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
      is_anonymous: isAnonymous,
      parent_id: replyTo,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setContent("");
      setReplyTo(null);
      setIsAnonymous(false);
      fetchComments();
    }
    setLoading(false);
  };

  const handleLike = async (commentId: string, isLiked: boolean) => {
    if (!user) { toast.error("Beğenmek için giriş yapmalısınız"); return; }
    try {
      if (isLiked) {
        await supabase.from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", commentId);
        await supabase.rpc("decrement_comment_like", { comment_id_input: commentId });
      } else {
        await supabase.from("comment_likes").insert({ user_id: user.id, comment_id: commentId } as any);
        await supabase.rpc("increment_comment_like", { comment_id_input: commentId });
      }
      fetchComments();
    } catch {
      toast.error("Bir hata oluştu");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Bu yorumu silmek istediğinizden emin misiniz?")) return;
    await supabase.from("comments").delete().eq("parent_id", commentId);
    const { error } = await supabase.from("comments").delete().eq("id", commentId);
    if (error) toast.error("Silinemedi");
    else { toast.success("Yorum silindi"); fetchComments(); }
  };

  const topLevel = comments.filter((c) => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => {
    const canDelete = isAdmin || user?.id === comment.user_id;
    return (
      <div className={`${isReply ? "ml-8" : ""} bg-secondary/30 rounded-lg p-3`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold flex items-center gap-1">
            {comment.is_anonymous && <EyeOff className="h-3 w-3 text-muted-foreground" />}
            {comment.username}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: tr })}
            </span>
            {canDelete && (
              <button onClick={() => handleDeleteComment(comment.id)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5" title="Sil">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed">{renderMentions(comment.content)}</p>
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => handleLike(comment.id, !!comment.userLiked)}
            className={`flex items-center gap-1 text-xs transition-colors ${
              comment.userLiked ? "text-destructive" : "text-muted-foreground hover:text-destructive"
            }`}
          >
            <Heart className={`h-3 w-3 ${comment.userLiked ? "fill-current" : ""}`} />
            {comment.like_count > 0 && <span>{comment.like_count}</span>}
          </button>
          {user && !isReply && (
            <button
              onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              <Reply className="h-3 w-3" /> Yanıtla
            </button>
          )}
          {user && (
            <ReportDialog targetType="comment" targetId={comment.id} />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 border-t pt-4 space-y-2.5">
      {topLevel.length === 0 && !user && (
        <p className="text-xs text-muted-foreground text-center py-2">Henüz yorum yok.</p>
      )}

      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-1.5">
          <CommentItem comment={comment} />
          {getReplies(comment.id).map((reply) => (
            <CommentItem key={reply.id} comment={reply} isReply />
          ))}
          {replyTo === comment.id && (
            <div className="ml-8 space-y-2">
              <MentionInput
                value={content}
                onChange={setContent}
                placeholder="Yanıtınızı yazın... (@kullanıcıadı ile bahsedin)"
                rows={2}
                className="text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox id={`anon-reply-${comment.id}`} checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
                  <label htmlFor={`anon-reply-${comment.id}`} className="text-xs text-muted-foreground">Anonim</label>
                </div>
                <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={loading || !content.trim()}>
                  {loading ? "..." : "Yanıtla"}
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {user && !replyTo && (
        <div className="space-y-2 pt-1">
          <MentionInput
            value={content}
            onChange={setContent}
            placeholder="Yorum yazın... (@kullanıcıadı ile bahsedin)"
            rows={2}
            className="text-sm"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox id="anon-comment" checked={isAnonymous} onCheckedChange={(v) => setIsAnonymous(!!v)} />
              <label htmlFor="anon-comment" className="text-xs text-muted-foreground">Anonim</label>
            </div>
            <Button size="sm" className="h-7 text-xs" onClick={handleSubmit} disabled={loading || !content.trim()}>
              {loading ? "..." : "Gönder"}
            </Button>
          </div>
        </div>
      )}

      {!user && (
        <p className="text-xs text-muted-foreground text-center">
          Yorum yapmak için <a href="/auth" className="text-primary hover:underline font-medium">giriş yapın</a>.
        </p>
      )}
    </div>
  );
}
