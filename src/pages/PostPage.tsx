import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import Layout from "@/components/Layout";
import CommentSection from "@/components/CommentSection";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import {
  ChevronUp, ChevronDown, Download, FileText,
  MessageCircle, EyeOff, Calendar, BookOpen
} from "lucide-react";
import ReportDialog from "@/components/ReportDialog";
import BookmarkButton from "@/components/BookmarkButton";
import { toast } from "sonner";
import { renderContent, getFileTypeLabel, getFileTypeColor } from "@/lib/content-renderer";
import type { Tables } from "@/integrations/supabase/types";

type PostWithProfile = Tables<"posts"> & { profiles: Tables<"profiles"> | null; course?: Tables<"courses"> | null };

const typeLabels: Record<string, string> = {
  notes: "Notlar",
  past_exams: "Çıkmış Sorular",
  discussion: "Tartışma",
  kaynaklar: "Kaynaklar",
};

const typeBadgeClass: Record<string, string> = {
  notes: "content-badge-notes",
  past_exams: "content-badge-exams",
  discussion: "content-badge-discussion",
  kaynaklar: "content-badge-kaynaklar",
};

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [post, setPost] = useState<PostWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState(0);
  const [localHelpful, setLocalHelpful] = useState(0);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (id) fetchPost();
  }, [id]);

  useEffect(() => {
    if (user && post) checkUserVote();
  }, [user, post?.id]);

  const fetchPost = async () => {
    setLoading(true);
    const { data } = await supabase.from("posts").select("*").eq("id", id!).single();
    if (data) {
      const [profileRes, courseRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", data.user_id).single(),
        supabase.from("courses").select("*").eq("id", data.course_id).single(),
      ]);
      const fullPost = { ...data, profiles: profileRes.data, course: courseRes.data } as any;
      setPost(fullPost);
      setLocalHelpful(data.helpful_count ?? 0);
    }
    setLoading(false);
  };

  const checkUserVote = async () => {
    if (!user || !post) return;
    const { data } = await supabase.from("votes").select("vote_type").eq("post_id", post.id).eq("user_id", user.id).maybeSingle();
    setUserVote(data ? (data as any).vote_type : 0);
  };

  const handleVote = useCallback(async (direction: 1 | -1) => {
    if (!user) { toast.error("Oy vermek için giriş yapmalısınız"); return; }
    if (!post || voting) return;
    setVoting(true);
    try {
      const { data, error } = await supabase.rpc("handle_vote", {
        p_post_id: post.id,
        p_user_id: user.id,
        p_direction: direction,
      });
      if (error) throw error;
      const result = data as any;
      setLocalHelpful(result.helpful_count);
      setUserVote(result.user_vote);
    } catch {
      toast.error("Bir hata oluştu");
    }
    setVoting(false);
  }, [user, post?.id, voting]);

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!post?.file_url || downloading) return;
    setDownloading(true);
    if (user) {
      try {
        await supabase.rpc("safe_increment_download", { p_post_id: post.id, p_user_id: user.id });
      } catch {}
    }
    window.open(post.file_url, "_blank");
    fetchPost();
    setTimeout(() => setDownloading(false), 3000);
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <StateBlock
            variant="loading"
            size="section"
            title="Gönderi yükleniyor"
            description="Gönderi detayları hazırlanıyor."
          />
        </div>
      </Layout>
    );
  }

  if (!post) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <StateBlock
            variant="noResults"
            size="section"
            title="Gönderi bulunamadı"
            description="Gönderi kaldırılmış olabilir veya bağlantı geçersiz olabilir."
            primaryAction={
              <Button asChild variant="outline" size="sm">
                <Link to="/">Ana sayfaya dön</Link>
              </Button>
            }
          />
        </div>
      </Layout>
    );
  }

  const displayName = (post as any).is_anonymous ? "Anonim" : (post.profiles?.username || "Anonim");
  const downloadCount = (post as any).download_count ?? 0;
  const commentCount = (post as any).comment_count ?? 0;
  const course = (post as any).course as Tables<"courses"> | null;
  const fileName = (post as any).file_name || "Dosya";
  const fileTypeLabel = getFileTypeLabel(fileName);
  const fileTypeColor = getFileTypeColor(fileName);

  if (typeof document !== "undefined") {
    const courseLabel = course ? `${course.name} - ` : "";
    document.title = `${post.title} | ${courseLabel}ACATALK`;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5 flex-wrap">
          <Link to="/" className="hover:text-primary transition-colors font-medium">Ana Sayfa</Link>
          <span>/</span>
          {course && (
            <>
              <Link to={`/course/${course.id}`} className="hover:text-primary transition-colors font-medium">{course.name}</Link>
              <span>/</span>
            </>
          )}
          <span className="text-foreground font-medium truncate max-w-[200px]">{post.title}</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Surface className="overflow-hidden" variant="raised" padding="none" border="none" radius="xl">
            <div className="p-5 sm:p-6 border-b">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${typeBadgeClass[post.content_type]}`}>
                  {typeLabels[post.content_type]}
                </span>
                {course && (
                  <Link to={`/course/${course.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors bg-secondary px-2 py-1 rounded-md">
                    <BookOpen className="h-3 w-3" />
                    {course.name}
                  </Link>
                )}
                {(post as any).is_anonymous && <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>

              <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-foreground leading-tight mb-3">
                {post.title}
              </h1>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px] font-bold bg-primary/10 text-primary">
                      {displayName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{displayName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}
                </div>
              </div>
            </div>

            <div className="flex">
              <div className="flex flex-col items-center gap-1 p-4 border-r bg-secondary/20">
                <button
                  onClick={() => handleVote(1)}
                  disabled={voting}
                  className={`p-1.5 rounded-lg transition-all ${userVote === 1 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5"} ${voting ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <ChevronUp className="h-6 w-6" strokeWidth={2.5} />
                </button>
                <span className={`text-lg font-extrabold ${localHelpful > 0 ? "text-primary" : localHelpful < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {localHelpful}
                </span>
                <button
                  onClick={() => handleVote(-1)}
                  disabled={voting}
                  className={`p-1.5 rounded-lg transition-all ${userVote === -1 ? "text-destructive bg-destructive/10" : "text-muted-foreground hover:text-destructive hover:bg-destructive/5"} ${voting ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <ChevronDown className="h-6 w-6" strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex-1 p-5 sm:p-6">
                {post.content && (
                  <div className="prose prose-sm max-w-none text-foreground leading-relaxed mb-5">
                    {renderContent(post.content)}
                  </div>
                )}

                {post.file_url && (
                  <div className="bg-secondary/40 rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0`}>
                        <FileText className={`h-5 w-5 ${fileTypeColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{fileName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fileTypeLabel} · {downloadCount} indirme
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="gap-1.5 shrink-0" onClick={handleDownload} disabled={downloading}>
                      <Download className="h-4 w-4" /> İndir
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-5 pt-4 border-t text-xs text-muted-foreground">
                  {downloadCount > 0 && (
                    <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" /> {downloadCount} indirme</span>
                  )}
                  <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {commentCount} yorum</span>
                  <span className="ml-auto flex items-center gap-3">
                    <BookmarkButton postId={post.id} size="md" />
                    <ReportDialog targetType="post" targetId={post.id} />
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-6 pb-5 sm:pb-6">
              <h3 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                Yorumlar ({commentCount})
              </h3>
              <CommentSection postId={post.id} />
            </div>
          </Surface>
        </motion.div>
      </div>
    </Layout>
  );
}
