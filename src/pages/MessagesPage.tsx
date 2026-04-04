import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import Layout from "@/components/Layout";
import UserSearchDialog from "@/components/UserSearchDialog";
import MentionInput, { renderMentions } from "@/components/MentionInput";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import { ArrowLeft, Send, MessageCircle, MoreVertical, Ban, EyeOff, Link2, Link2Off } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useIsUserOnline, useOnlineUsers } from "@/hooks/useGlobalPresence";

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  other_username: string;
  other_user_id: string;
  status: string;
  hidden_for_user1: boolean;
  hidden_for_user2: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get("to");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [myUsername, setMyUsername] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dmTypingChannel = activeConv ? `dm-typing-${activeConv}` : "";
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(dmTypingChannel, user?.id, myUsername);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setMyUsername(data?.username || "Kullanıcı"));
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading]);

  useEffect(() => {
    if (user) fetchConversations();
  }, [user]);

  useEffect(() => {
    if (user && targetUserId && targetUserId !== user.id) {
      startOrOpenConversation(targetUserId);
    }
  }, [user, targetUserId]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv);
      const channel = supabase
        .channel(`msgs-${activeConv}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConv}` }, (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (data && data.length > 0) {
      const otherIds = data.map((c: any) => c.user1_id === user.id ? c.user2_id : c.user1_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", otherIds);
      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.username]) || []);

      const allConvs = data
        .map((c: any) => {
          const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
          const isUser1 = c.user1_id === user.id;
          const isHidden = isUser1 ? c.hidden_for_user1 : c.hidden_for_user2;
          return {
            ...c,
            other_user_id: otherId,
            other_username: profileMap.get(otherId) || "Kullanıcı",
            _isHidden: isHidden,
          };
        })
        .filter((c: any) => !c._isHidden);

      setConversations(allConvs);
    } else {
      setConversations([]);
    }
  };

  const fetchMessages = async (convId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);
  };

  const isBlocked = async (userId1: string, userId2: string): Promise<boolean> => {
    const { data } = await supabase
      .from("blocked_users")
      .select("id")
      .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
      .limit(1);
    return (data && data.length > 0) || false;
  };

  const isConnected = async (otherUserId: string): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from("connections")
      .select("id")
      .eq("status", "accepted")
      .or(`and(requester_id.eq.${user.id},target_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},target_id.eq.${user.id})`)
      .limit(1);
    return (data && data.length > 0) || false;
  };

  const startOrOpenConversation = async (otherUserId: string) => {
    if (!user) return;

    if (await isBlocked(user.id, otherUserId)) {
      toast.error("Bu kullanıcıyla mesajlaşma engellendi.");
      return;
    }

    // Check if the other user has disabled DMs or DND mode
    const { data: otherSettings } = await supabase.from("user_settings").select("dm_allowed, dnd_mode").eq("user_id", otherUserId).maybeSingle();
    if ((otherSettings as any)?.dm_allowed === "nobody") {
      toast.error("Bu kullanıcı DM almayı kapatmış.");
      return;
    }
    if ((otherSettings as any)?.dnd_mode === true) {
      toast.error("Bu kullanıcı şu anda rahatsız etmeyin modunda.");
      return;
    }

    // Check if users are connected (accepted connection required)
    const connected = await isConnected(otherUserId);
    if (!connected) {
      toast.error("Mesaj göndermek için önce bağlantı kurmanız gerekiyor.");
      return;
    }

    const { data: existing } = await supabase
      .from("conversations")
      .select("*")
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`);

    if (existing && existing.length > 0) {
      const conv = existing[0] as any;
      const isUser1 = conv.user1_id === user.id;
      if (isUser1 && conv.hidden_for_user1) {
        await supabase.from("conversations").update({ hidden_for_user1: false } as any).eq("id", conv.id);
      } else if (!isUser1 && conv.hidden_for_user2) {
        await supabase.from("conversations").update({ hidden_for_user2: false } as any).eq("id", conv.id);
      }
      setActiveConv(conv.id);
      await fetchConversations();
      return;
    }

    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({ user1_id: user.id, user2_id: otherUserId, status: "accepted" } as any)
      .select()
      .single();

    if (!error && newConv) {
      setActiveConv((newConv as any).id);
      await fetchConversations();
    }
  };

  const handleHideConversation = async (conv: Conversation) => {
    if (!user) return;
    const isUser1 = conv.user1_id === user.id;
    const updateField = isUser1 ? "hidden_for_user1" : "hidden_for_user2";
    await supabase.from("conversations").update({ [updateField]: true } as any).eq("id", conv.id);
    toast.success("Konuşma listeden kaldırıldı.");
    if (activeConv === conv.id) setActiveConv(null);
    fetchConversations();
  };

  const handleBlockUser = async (otherUserId: string) => {
    if (!user) return;
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherUserId } as any);
    if (!error) {
      toast.success("Kullanıcı engellendi.");
      const conv = conversations.find((c) => c.other_user_id === otherUserId);
      if (conv) {
        const isUser1 = conv.user1_id === user.id;
        await supabase.from("conversations").update({ [isUser1 ? "hidden_for_user1" : "hidden_for_user2"]: true } as any).eq("id", conv.id);
      }
      if (activeConv) setActiveConv(null);
      fetchConversations();
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !activeConv || !newMsg.trim() || sending) return;

    // Instant client-side block
    const quickCheck = quickContentCheck(newMsg.trim());
    if (!quickCheck.safe) {
      toast.error(quickCheck.reason || "Bu mesaj platform kurallarını ihlal ediyor.");
      return;
    }

    setSending(true);
    try {
      // Check moderation status
      const status = await checkUserModerationStatus(user.id);
      if (!status.canPost) {
        toast.error(status.reason || "Mesaj göndermeniz engellenmiştir.");
        return;
      }

      // Check URLs for safety
      const urlCheck = checkTextUrls(newMsg.trim());
      if (!urlCheck.safe) {
        toast.error(urlCheck.reason || "Mesajınızdaki bir bağlantı platform kurallarını ihlal ediyor.");
        return;
      }

      // Moderate text
      const modResult = await moderateText(newMsg.trim(), "direct_message");
      if (!modResult.safe) {
        toast.error(getViolationMessage(modResult.violation_type));
        return;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConv,
        sender_id: user.id,
        content: newMsg.trim(),
      });
      if (!error) {
        await supabase.from("conversations").update({ last_message_at: new Date().toISOString() } as any).eq("id", activeConv);
        setNewMsg("");
        stopTyping();
      }
    } finally {
      setSending(false);
    }
  };

  const handleUserSelected = (userId: string) => {
    startOrOpenConversation(userId);
  };

  if (authLoading || !user) return null;

  const activeConvData = conversations.find((c) => c.id === activeConv);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageCircle className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-extrabold">Mesajlar</h1>
            <p className="text-xs text-muted-foreground">Bağlantılarınızla mesajlaşın</p>
          </div>
          <div className="ml-auto">
            <UserSearchDialog onUserSelected={handleUserSelected} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: "64vh" }}>
          {/* Conversation List */}
          <Surface
            variant="soft"
            border="subtle"
            padding="none"
            radius="lg"
            className={`overflow-hidden ${activeConv ? "hidden md:block" : ""}`}
          >
            <div className="p-3 border-b border-border/70 flex items-center gap-2">
              <Link2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Sohbetler</span>
            </div>
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {conversations.length > 0 ? conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveConv(c.id)}
                  className={`w-full text-left flex items-center gap-3 p-3 hover:bg-secondary/40 transition-colors ${activeConv === c.id ? "bg-primary/10" : ""}`}
                >
                  <div className="relative">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {c.other_username[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <OnlineDot userId={c.other_user_id} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.other_username}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: tr })}
                    </p>
                  </div>
                </button>
              )) : (
                <StateBlock
                  variant="empty"
                  size="inline"
                  icon={<Link2Off className="h-4 w-4" />}
                  title="Henüz sohbet yok"
                  description="Bağlantı kurduğunuz kullanıcılarla burada sohbet başlatabilirsiniz."
                  className="m-3"
                />
              )}
            </div>
          </Surface>

          {/* Chat Area */}
          <Surface
            variant="soft"
            border="subtle"
            padding="none"
            radius="lg"
            className={`md:col-span-2 flex flex-col overflow-hidden ${!activeConv ? "hidden md:flex" : ""}`}
          >
            {activeConv && activeConvData ? (
              <>
                <div className="p-3 border-b border-border/70 flex items-center gap-3">
                  <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0" onClick={() => setActiveConv(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                        {activeConvData.other_username[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <OnlineDot userId={activeConvData.other_user_id} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{activeConvData.other_username}</p>
                    {typingUsers.length > 0 ? (
                      <p className="text-xs text-primary animate-pulse flex items-center gap-1">
                        <span className="flex gap-0.5">
                          <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                        yazıyor...
                      </p>
                    ) : (
                      <OnlineStatusText userId={activeConvData.other_user_id} />
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleHideConversation(activeConvData)}>
                        <EyeOff className="h-3.5 w-3.5 mr-2" /> Konuşmayı Kaldır
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleBlockUser(activeConvData.other_user_id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Ban className="h-3.5 w-3.5 mr-2" /> Kullanıcıyı Engelle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[54vh] bg-background/40">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                        m.sender_id === user.id
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-secondary rounded-bl-md"
                      }`}>
                        <p className="text-sm leading-relaxed">{renderMentions(m.content)}</p>
                        <p className={`text-xs mt-1 ${m.sender_id === user.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: tr })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="p-3 border-t border-border/70 flex gap-2 items-end bg-card/70">
                  <div className="flex-1">
                    <MentionInput
                      value={newMsg}
                      onChange={(val) => { setNewMsg(val); sendTyping(); }}
                      onSubmit={() => handleSend()}
                      placeholder="Mesajınızı yazın..."
                      rows={1}
                      className="min-h-[40px] max-h-[100px] rounded-xl resize-none"
                      maxLength={2000}
                    />
                  </div>
                  <Button type="submit" size="icon" className="h-10 w-10 rounded-xl shrink-0" disabled={sending || !newMsg.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 p-4">
                <StateBlock
                  variant="empty"
                  size="section"
                  icon={<MessageCircle className="h-5 w-5" />}
                  title="Bir konusma secin"
                  description="Sol listeden sohbet secin veya yeni sohbet baslatin."
                />
              </div>
            )}
          </Surface>
        </div>
      </div>
    </Layout>
  );
}

function OnlineDot({ userId }: { userId: string }) {
  const online = useIsUserOnline(userId);
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
    />
  );
}

function OnlineStatusText({ userId }: { userId: string }) {
  const online = useIsUserOnline(userId);
  return (
    <p className={`text-xs ${online ? "text-emerald-500" : "text-muted-foreground"}`}>
      {online ? "Çevrimiçi" : "Çevrimdışı"}
    </p>
  );
}
