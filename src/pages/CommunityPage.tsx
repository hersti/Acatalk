import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import Layout from "@/components/Layout";
import MentionInput, { renderMentions } from "@/components/MentionInput";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Send, Globe, Trash2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useTypingIndicator, TypingIndicator } from "@/hooks/useTypingIndicator";

interface CommunityMsg {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username?: string;
}

export default function CommunityPage() {
  const { user, isAdmin } = useAuth();
  const [messages, setMessages] = useState<CommunityMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [myUsername, setMyUsername] = useState<string>();
  const onlineCount = useOnlinePresence("community-presence", user?.id);
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator("community-chat-typing", user?.id, myUsername);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setMyUsername(data?.username || "Kullanıcı"));
  }, [user]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel("community-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages" }, async (payload) => {
        const msg = payload.new as any;
        const { data: profile } = await supabase.from("profiles").select("username").eq("user_id", msg.user_id).maybeSingle();
        setMessages((prev) => [...prev, { ...msg, username: profile?.username || "Kullanıcı" }]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_messages" }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("community_messages").select("*")
      .order("created_at", { ascending: true }).limit(200);

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((m: any) => m.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);
      setMessages(data.map((m: any) => ({ ...m, username: profileMap.get(m.user_id) || "Kullanıcı" })));
    }
    setTimeout(() => { initialLoadDone.current = true; }, 100);
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !newMsg.trim() || sending) return;

    // Instant client-side block (no network call)
    const quickCheck = quickContentCheck(newMsg.trim());
    if (!quickCheck.safe) {
      toast.error(quickCheck.reason || "Bu mesaj platform kurallarını ihlal ediyor.");
      return;
    }

    setSending(true);

    const status = await checkUserModerationStatus(user.id);
    if (!status.canPost) {
      toast.error(status.reason || "Mesaj göndermeniz engellenmiştir.");
      setSending(false);
      return;
    }

    // Check URLs for safety
    const urlCheck = checkTextUrls(newMsg.trim());
    if (!urlCheck.safe) {
      toast.error(urlCheck.reason || "Mesajınızdaki bir bağlantı platform kurallarını ihlal ediyor.");
      setSending(false);
      return;
    }

    const modResult = await moderateText(newMsg.trim(), "community_message");
    if (!modResult.safe) {
      toast.error(getViolationMessage(modResult.violation_type));
      setSending(false);
      return;
    }

    const { error } = await supabase.from("community_messages").insert({ user_id: user.id, content: newMsg.trim() });
    if (error) toast.error("Gönderilemedi");
    else { setNewMsg(""); stopTyping(); }
    setSending(false);
  };

  const handleDelete = async (msgId: string) => {
    await supabase.from("community_messages").delete().eq("id", msgId);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-hero flex items-center justify-center shadow-sm">
              <Globe className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-xl font-extrabold">Topluluk Sohbeti</h1>
              <p className="text-xs text-muted-foreground">Tüm öğrencilere açık genel sohbet</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/70 px-2.5 py-1.5 rounded-full">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{onlineCount} çevrimiçi</span>
          </div>
        </div>

        <Card className="flex flex-col overflow-hidden border-border/70 surface-soft" style={{ height: "calc(100vh - 220px)" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <Globe className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">Henüz mesaj yok</p>
                <p className="text-xs text-muted-foreground mt-1">İlk mesajı siz yazın!</p>
              </div>
            )}
            {messages.map((m, i) => {
              const isOwn = m.user_id === user?.id;
              const showAvatar = i === 0 || messages[i - 1]?.user_id !== m.user_id;
              return (
                <div key={m.id} className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""}`}>
                  {showAvatar ? (
                    <Link to={`/user/${m.user_id}`}>
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                          {(m.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : <div className="w-8 shrink-0" />}
                  <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                    {showAvatar && (
                      <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? "justify-end" : ""}`}>
                        {!isOwn && (
                          <Link to={`/user/${m.user_id}`} className="text-xs font-semibold hover:text-primary transition-colors">
                            {m.username}
                          </Link>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(m.created_at!), { addSuffix: true, locale: tr })}
                        </span>
                        {isAdmin && (
                          <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className={`inline-block rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary rounded-bl-md"
                    }`}>
                      {renderMentions(m.content)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {user ? (
            <>
              <TypingIndicator typingUsers={typingUsers} />
              <form onSubmit={handleSend} className="p-3 border-t border-border/70 bg-card/70 flex gap-2 items-end">
                <div className="flex-1">
                  <MentionInput
                    value={newMsg}
                    onChange={(val) => { setNewMsg(val); sendTyping(); }}
                    onSubmit={() => handleSend()}
                    placeholder="Topluluğa mesaj yazın... (@kullanıcı ile etiketleyin)"
                    rows={1}
                    className="min-h-[40px] max-h-[100px] rounded-xl resize-none border-border/50"
                    maxLength={1000}
                  />
                </div>
                <Button type="submit" size="icon" className="h-10 w-10 rounded-xl shrink-0" disabled={sending || !newMsg.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          ) : (
            <div className="p-3 border-t border-border/70 text-center bg-card/70">
              <p className="text-xs text-muted-foreground">
                Mesaj yazmak için <Link to="/auth" className="text-primary font-semibold hover:underline">giriş yapın</Link>.
              </p>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
