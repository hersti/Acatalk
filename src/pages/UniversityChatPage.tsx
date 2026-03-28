import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import MentionInput from "@/components/MentionInput";
import { renderMentions } from "@/components/MentionInput";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Send, Lock, GraduationCap, Loader2, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { sanitizeInput } from "@/lib/sanitize";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useTypingIndicator, TypingIndicator } from "@/hooks/useTypingIndicator";

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
  }, [user, authLoading]);

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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!university) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-md text-center">
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="font-heading text-xl font-bold mb-2">Üniversite Sohbeti</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Üniversite sohbetine katılmak için profilinizde üniversitenizi belirtmelisiniz.
          </p>
          <Button onClick={() => navigate("/settings")}>Profili Düzenle</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="overflow-hidden border-border/70 surface-soft">
          <div className="px-4 py-3 border-b border-border/70 bg-secondary/30 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-primary" />
            <h1 className="font-heading text-sm font-bold">{university} Sohbet</h1>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/70 px-2 py-1 rounded-full">
                <Users className="h-3 w-3 text-primary" />
                <span className="font-medium">{onlineCount} çevrimiçi</span>
              </div>
              <Lock className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Sadece {university} öğrencileri</span>
            </div>
          </div>

          <ScrollArea className="h-[60vh]">
            <div className="p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Henüz mesaj yok. İlk mesajı siz yazın!
                </p>
              )}
              {messages.map((msg) => {
                const isOwn = msg.user_id === user?.id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                        {(msg.profiles?.username || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${isOwn ? "text-right" : ""}`}>
                      <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">
                        {msg.profiles?.username || "Anonim"} · {formatDistanceToNow(new Date(msg.created_at!), { addSuffix: true, locale: tr })}
                      </p>
                      <div className={`inline-block px-3 py-2 rounded-xl text-sm ${isOwn ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                        {renderMentions(msg.content)}
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
        </Card>
      </div>
    </Layout>
  );
}
