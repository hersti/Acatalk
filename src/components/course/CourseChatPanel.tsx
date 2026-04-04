import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { MessageCircle, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StateBlock } from "@/components/ui/state-blocks";
import { Textarea } from "@/components/ui/textarea";
import { Surface } from "@/components/ui/surface";
import { useCourseChat } from "@/hooks/useCourseChat";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";

interface CourseChatPanelProps {
  courseId: string;
  courseName: string;
  courseUniversity: string;
  canWrite: boolean;
  isLoggedIn: boolean;
  userId?: string;
  onOpenDiscussionTab: () => void;
}

export default function CourseChatPanel({
  courseId,
  courseName,
  courseUniversity,
  canWrite,
  isLoggedIn,
  userId,
  onOpenDiscussionTab,
}: CourseChatPanelProps) {
  const [message, setMessage] = useState("");
  const { messages, loading, sending, featureUnavailable, sendMessage } = useCourseChat({
    courseId,
    enabled: true,
  });

  const canSend = useMemo(() => !!message.trim() && !sending && canWrite && !!userId, [canWrite, message, sending, userId]);

  const handleSend = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend || !userId) return;

    const content = message.trim();

    const quickCheck = quickContentCheck(content);
    if (!quickCheck.safe) {
      toast.error(quickCheck.reason || "Mesajınız platform kurallarını ihlal ediyor.");
      return;
    }

    const status = await checkUserModerationStatus(userId);
    if (!status.canPost) {
      toast.error(status.reason || "Mesaj göndermeniz engellenmiştir.");
      return;
    }

    const urlCheck = checkTextUrls(content);
    if (!urlCheck.safe) {
      toast.error(urlCheck.reason || "Mesajınızdaki bağlantı platform kurallarını ihlal ediyor.");
      return;
    }

    const modResult = await moderateText(content, "course_chat_message", courseId);
    if (!modResult.safe) {
      toast.error(getViolationMessage(modResult.violation_type));
      return;
    }

    const result = await sendMessage(userId, content);
    if (!result.ok) {
      toast.error(result.message || "Mesaj gönderilemedi.");
      return;
    }

    setMessage("");
  };

  return (
    <Surface variant="soft" border="subtle" padding="none" radius="xl" className="overflow-hidden">
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-sm font-bold flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-primary" />
              Ders Sohbeti
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {courseName} dersi için hızlı koordinasyon ve anlık yardımlaşma alanı.
            </p>
          </div>
          <div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
            Beta
          </div>
        </div>
      </div>

      {featureUnavailable ? (
        <div className="p-4">
          <StateBlock
            variant="empty"
            size="section"
            icon={<Sparkles className="h-4 w-4" />}
            title="Ders sohbeti hazırlanıyor"
            description="Altyapı bu ders için henüz tamamlanmadı. Kısa süre içinde canlı sohbet açılacak."
            primaryAction={
              <Button size="sm" variant="outline" onClick={onOpenDiscussionTab}>
                Tartışmalara Geç
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="max-h-[440px] overflow-y-auto p-4 space-y-2">
            {loading ? (
              <StateBlock
                variant="loading"
                size="inline"
                title="Sohbet yükleniyor"
                description="Mesaj akışı hazırlanıyor."
              />
            ) : messages.length === 0 ? (
              <StateBlock
                variant="empty"
                size="section"
                icon={<MessageCircle className="h-4 w-4" />}
                title="Henüz mesaj yok"
                description="İlk mesajı yazıp ders için hızlı iletişimi başlatabilirsiniz."
                primaryAction={
                  <Button size="sm" variant="outline" onClick={onOpenDiscussionTab}>
                    Akademik Tartışma Aç
                  </Button>
                }
              />
            ) : (
              messages.map((chatMessage) => (
                <div key={chatMessage.id} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/70 px-3 py-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                      {(chatMessage.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold truncate">{chatMessage.username}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(chatMessage.created_at), { addSuffix: true, locale: tr })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap break-words">{chatMessage.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border/70 p-3">
            {isLoggedIn ? (
              canWrite ? (
                <form onSubmit={handleSend} className="space-y-2">
                  <Textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Ders için kısa bir mesaj yazın..."
                    rows={2}
                    maxLength={1000}
                    className="min-h-[72px] resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Akademik sohbet kısa ve odaklı ilerler, kalıcı bilgi için Tartışmalar sekmesini kullanın.
                    </p>
                    <Button type="submit" size="sm" className="gap-1.5" disabled={!canSend}>
                      <Send className="h-3.5 w-3.5" />
                      Gönder
                    </Button>
                  </div>
                </form>
              ) : (
                <StateBlock
                  variant="forbidden"
                  size="inline"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Yazma yetkisi sınırlı"
                  description={`Ders sohbetine mesaj yazmak için ${courseUniversity} öğrencisi olmalısınız.`}
                  primaryAction={
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/settings">Profili Düzenle</Link>
                    </Button>
                  }
                />
              )
            ) : (
              <StateBlock
                variant="forbidden"
                size="inline"
                title="Mesaj yazmak için giriş yapın"
                description="Sohbete katılmak için hesabınıza giriş yapabilirsiniz."
                primaryAction={
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/auth">Giriş Yap</Link>
                  </Button>
                }
              />
            )}
          </div>
        </>
      )}
    </Surface>
  );
}
