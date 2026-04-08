import { FormEvent, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowRight, BookOpen, MessageCircle, RefreshCcw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const { messages, room, loading, sending, featureUnavailable, error, sendMessage, refresh } = useCourseChat({
    courseId,
    enabled: true,
    userId,
  });

  const canSend = useMemo(() => !!message.trim() && !sending && canWrite && !!userId, [canWrite, message, sending, userId]);

  const lastActivityAt = useMemo(
    () => messages[messages.length - 1]?.created_at || room?.lastMessageAt || null,
    [messages, room?.lastMessageAt],
  );

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
      <div className="border-b border-border/70 bg-gradient-to-b from-card to-card/95 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading flex items-center gap-1.5 text-sm font-bold">
              <MessageCircle className="h-4 w-4 text-primary" />
              Ders Sohbeti · Hızlı İletişim
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{courseName} dersi için anlık koordinasyon, hızlı soru-cevap ve kısa sınıf içi iletişim alanı.</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {room ? `Toplam mesaj: ${room.messageCount}` : "Bu ders için sohbet odası hazır."}
              {lastActivityAt ? `  Son aktivite: ${formatDistanceToNow(new Date(lastActivityAt), { addSuffix: true, locale: tr })}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Kalıcı akademik içerikler için Tartışmalar sekmesini kullanın.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">Canlı</div>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={onOpenDiscussionTab}>
              Tartışmaya Geç
              <ArrowRight className="h-3 w-3" />
            </Button>
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
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onOpenDiscussionTab}>
                <BookOpen className="h-3.5 w-3.5" />
                Tartışmalara Geç
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="max-h-[440px] space-y-2 overflow-y-auto bg-gradient-to-b from-secondary/45 to-background p-3.5">
            {loading ? (
              <StateBlock variant="loading" size="inline" title="Sohbet yükleniyor" description="Mesaj akışı hazırlanıyor." />
            ) : error ? (
              <StateBlock
                variant="error"
                size="section"
                title="Sohbet yüklenemedi"
                description={error}
                primaryAction={
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void refresh()}>
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Tekrar Dene
                  </Button>
                }
              />
            ) : messages.length === 0 ? (
              <StateBlock
                variant="empty"
                size="section"
                icon={<MessageCircle className="h-4 w-4" />}
                title="Sohbet henüz başlamadı"
                description="Bu alan kısa ve hızlı iletişim içindir. Kalıcı konu başlıkları için Tartışmalar sekmesini kullanın."
                primaryAction={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      composerRef.current?.focus();
                    }}
                  >
                    İlk Mesajı Yaz
                  </Button>
                }
                secondaryAction={
                  <Button size="sm" variant="ghost" className="gap-1" onClick={onOpenDiscussionTab}>
                    <BookOpen className="h-3.5 w-3.5" />
                    Akademik Tartışmaya Geç
                  </Button>
                }
              />
            ) : (
              messages.map((chatMessage) => {
                const username = chatMessage.username || "kullanici";
                const isOwnMessage = userId ? chatMessage.user_id === userId : false;
                return (
                  <div key={chatMessage.id} className={`flex items-start gap-2.5 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                    {!isOwnMessage ? (
                      <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                        {chatMessage.avatarUrl ? <AvatarImage src={chatMessage.avatarUrl} alt={chatMessage.displayName} /> : null}
                        <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                          {(chatMessage.displayName || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    <div className={`min-w-0 max-w-[88%] rounded-xl border px-3 py-2 ${isOwnMessage ? "border-primary/25 bg-primary/10" : "border-border/60 bg-card/85"}`}>
                      <div className="flex items-center gap-1.5">
                        <Link to={`/user/${chatMessage.user_id}`} className="truncate text-xs font-semibold transition-colors hover:text-primary">
                          {chatMessage.displayName}
                        </Link>
                        <Link to={`/user/${chatMessage.user_id}`} className="text-[10px] text-muted-foreground transition-colors hover:text-primary">
                          @{username}
                        </Link>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(chatMessage.created_at), { addSuffix: true, locale: tr })}
                        </span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{chatMessage.content}</p>
                    </div>
                    {isOwnMessage ? (
                      <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                        {chatMessage.avatarUrl ? <AvatarImage src={chatMessage.avatarUrl} alt={chatMessage.displayName} /> : null}
                        <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                          {(chatMessage.displayName || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border/70 bg-card/90 p-3">
            {isLoggedIn ? (
              canWrite ? (
                <form onSubmit={handleSend} className="space-y-2.5">
                  <div className="rounded-xl border border-border/70 bg-background/70 p-2.5">
                    <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                      Kısa, ders odaklı ve anlık iletişim mesajı yazın.
                    </p>
                  <Textarea
                    ref={composerRef}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Örn: 14:00 etüt odası değişti mi?"
                    rows={2}
                    maxLength={1000}
                    className="min-h-[72px] resize-none border-0 bg-transparent px-0 py-1 shadow-none focus-visible:ring-0"
                  />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        Kalıcı bilgi ve uzun çözüm için Tartışmalar sekmesine geçin.
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{message.trim().length}/1000 karakter</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" variant="ghost" className="h-8 text-[11px]" onClick={onOpenDiscussionTab}>
                        Tartışmaya Taşı
                      </Button>
                      <Button type="submit" size="sm" className="shrink-0 gap-1.5" disabled={!canSend}>
                      <Send className="h-3.5 w-3.5" />
                      Gönder
                      </Button>
                    </div>
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
