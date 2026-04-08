import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MentionInput from "@/components/MentionInput";
import { RenderMentions } from "@/components/MentionRenderer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import { AcademicMeta } from "@/components/ui/academic-meta";
import { toast } from "sonner";
import { Send, Lock, GraduationCap, Loader2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { sanitizeInput } from "@/lib/sanitize";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { TypingIndicator } from "@/components/TypingIndicator";

interface ChatMessage {
  id: string;
  content: string;
  user_id: string;
  university: string;
  created_at: string;
  profiles?: { username: string | null; avatar_url: string | null } | null;
}

export default function UniversityChatPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [university, setUniversity] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const presenceChannel = university ? `uni-presence-${university.replace(/\s+/g, '-')}` : "";
  const typingChannel = university ? `uni-typing-${university.replace(/\s+/g, '-')}` : "";
  const onlineCount = useOnlinePresence(presenceChannel, user?.id);
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(typingChannel, user?.id, myUsername);
  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("university, username")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setUniversity(data?.university || null);
        setMyUsername(data?.username || "Kullanıcı");
        setLoadingProfile(false);
      });
  }, [user]);

  useEffect(() => {
    if (!university) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("university_messages")
        .select("*, profiles:user_id(username, avatar_url)")
        .eq("university", university)
        .order("created_at", { ascending: true })
        .limit(100);
      setMessages((data as any[]) || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };

    fetchMessages();

    const channel = supabase
      .channel(`uni-chat-${university}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "university_messages", filter: `university=eq.${university}` }, async (payload) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", payload.new.user_id)
          .maybeSingle();
        const newMsg = { ...payload.new, profiles: profile } as ChatMessage;
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [university]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !university || sending) return;

    // Instant client-side block
    const quickCheck = quickContentCheck(newMessage.trim());
    if (!quickCheck.safe) {
      toast.error(quickCheck.reason || "Bu mesaj platform kurallarını ihlal ediyor.");
      return;
    }

    setSending(true);
    try {
      const status = await checkUserModerationStatus(user.id);
      if (!status.canPost) {
        toast.error(status.reason || "Mesaj göndermeniz engellenmiştir.");
        return;
      }

      // Check URLs for safety
      const urlCheck = checkTextUrls(newMessage.trim());
      if (!urlCheck.safe) {
        toast.error(urlCheck.reason || "Mesajınızdaki bir bağlantı platform kurallarını ihlal ediyor.");
        return;
      }

      const modResult = await moderateText(newMessage.trim(), "university_message");
      if (!modResult.safe) {
        toast.error(getViolationMessage(modResult.violation_type));
        return;
      }

      const { error } = await supabase.from("university_messages").insert({
        university,
        user_id: user.id,
        content: sanitizeInput(newMessage.trim()),
      });
      if (error) throw error;
      setNewMessage("");
      stopTyping();
    } catch (err: any) {
      toast.error("Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  };

  if (loadingProfile) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <StateBlock
            variant="loading"
            size="section"
            title="Üniversite bilgisi yükleniyor"
            description="Sohbet erişimi kontrol ediliyor."
          />
        </div>
      </Layout>
    );
  }

  if (!university) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <StateBlock
            variant="forbidden"
            size="section"
            icon={<Lock className="h-5 w-5" />}
            title="Üniversite Sohbeti"
            description="Üniversite sohbetine katılmak için profilinizde üniversite bilgisi belirtmelisiniz."
            primaryAction={
              <Button onClick={() => navigate("/settings")} size="sm">
                Profili Düzenle
              </Button>
            }
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Surface className="overflow-hidden" variant="soft" border="subtle" padding="none" radius="lg">
          <div className="px-4 py-3 border-b border-border/70 bg-secondary/30 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="font-heading text-sm font-bold">{university} Sohbet</h1>
              <AcademicMeta
                size="sm"
                tone="muted"
                wrap={false}
                className="mt-1"
                items={[
                  { kind: "verified", label: "Doğrulanmış öğrenci", emphasis: "default" },
                  { kind: "university", label: "Üniversite", value: university, emphasis: "subtle" },
                ]}
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/70 px-2 py-1 rounded-full">
                <Users className="h-3 w-3 text-primary" />
                <span className="font-medium">{onlineCount} çevrimiçi</span>
              </div>
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sadece {university} öğrencileri</span>
            </div>
          </div>

          <ScrollArea className="h-[60vh]">
            <div className="p-4 space-y-3">
              {messages.length === 0 && (
                <StateBlock
                  variant="empty"
                  size="inline"
                  title="Henüz mesaj yok"
                  description="İlk mesajı siz yazın."
                  className="py-8"
                />
              )}
              {messages.map((msg) => {
                const isOwn = msg.user_id === user?.id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {(msg.profiles?.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${isOwn ? "text-right" : ""}`}>
                      <p className="text-xs text-muted-foreground mb-0.5 font-medium">
                        {msg.profiles?.username || "Anonim"} · {formatDistanceToNow(new Date(msg.created_at!), { addSuffix: true, locale: tr })}
                      </p>
                      <div className={`inline-block px-3 py-2 rounded-xl text-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                        <RenderMentions text={msg.content} />
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <TypingIndicator typingUsers={typingUsers} />
          <div className="p-3 border-t border-border/70 bg-card/70">
            <div className="flex gap-2">
              <div className="flex-1">
                <MentionInput
                  value={newMessage}
                  onChange={(val) => { setNewMessage(val); sendTyping(); }}
                  onSubmit={handleSend}
                  placeholder="Mesajınızı yazın..."
                  rows={1}
                  maxLength={500}
                  className="min-h-[40px] resize-none"
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                size="icon"
                className="h-10 w-10 rounded-lg shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </Surface>
      </div>
    </Layout>
  );
}
