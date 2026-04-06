import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowLeft,
  Ban,
  Bell,
  BookOpen,
  EyeOff,
  Link2,
  Link2Off,
  MessageCircle,
  MoreVertical,
  Send,
} from "lucide-react";

import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import UserSearchDialog from "@/components/UserSearchDialog";
import MentionInput, { renderMentions } from "@/components/MentionInput";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useIsUserOnline } from "@/hooks/useGlobalPresence";

type ConversationRow = Tables<"conversations">;
type MessageRow = Tables<"messages">;
type ProfileMini = Pick<Tables<"profiles">, "user_id" | "username">;
type UserSettingsRow = Pick<Tables<"user_settings">, "dm_allowed" | "dnd_mode">;

type ConversationUI = ConversationRow & {
  other_username: string;
  other_user_id: string;
};

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetUserId = searchParams.get("to");

  const [conversations, setConversations] = useState<ConversationUI[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [myUsername, setMyUsername] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const dmTypingChannel = activeConv ? `dm-typing-${activeConv}` : "";
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(dmTypingChannel, user?.id, myUsername);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setMyUsername(data?.username || "Kullanıcı"));
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!activeConv) return;
    void fetchMessages(activeConv);

    const channel = supabase
      .channel(`msgs-${activeConv}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConv}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as MessageRow]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    const rows = (data || []) as ConversationRow[];
    if (!rows.length) {
      setConversations([]);
      return;
    }

    const otherUserIds = rows.map((conv) => (conv.user1_id === user.id ? conv.user2_id : conv.user1_id));
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", otherUserIds);
    const profiles = (profilesData || []) as ProfileMini[];
    const profileMap = new Map(profiles.map((item) => [item.user_id, item.username || "Kullanıcı"]));

    const normalized = rows
      .map((conv) => {
        const isUser1 = conv.user1_id === user.id;
        const otherUserId = isUser1 ? conv.user2_id : conv.user1_id;
        const isHidden = isUser1 ? conv.hidden_for_user1 : conv.hidden_for_user2;
        return {
          conv,
          isHidden,
          otherUserId,
          otherUsername: profileMap.get(otherUserId) || "Kullanıcı",
        };
      })
      .filter((item) => !item.isHidden)
      .map(
        (item) =>
          ({
            ...item.conv,
            other_user_id: item.otherUserId,
            other_username: item.otherUsername,
          }) satisfies ConversationUI,
      );

    setConversations(normalized);
  }, [user]);

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages((data || []) as MessageRow[]);
  };

  const isBlocked = useCallback(async (userId1: string, userId2: string): Promise<boolean> => {
    const { data } = await supabase
      .from("blocked_users")
      .select("id")
      .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
      .limit(1);
    return Boolean(data && data.length > 0);
  }, []);

  const isConnected = useCallback(async (otherUserId: string): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase
      .from("connections")
      .select("id")
      .eq("status", "accepted")
      .or(`and(requester_id.eq.${user.id},target_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},target_id.eq.${user.id})`)
      .limit(1);
    return Boolean(data && data.length > 0);
  }, [user]);

  const startOrOpenConversation = useCallback(async (otherUserId: string) => {
    if (!user) return;

    if (await isBlocked(user.id, otherUserId)) {
      toast.error("Bu kullanıcıyla mesajlaşma engellendi.");
      return;
    }

    const { data: otherSettings } = await supabase
      .from("user_settings")
      .select("dm_allowed, dnd_mode")
      .eq("user_id", otherUserId)
      .maybeSingle();
    const settings = otherSettings as UserSettingsRow | null;

    if (settings?.dm_allowed === "nobody") {
      toast.error("Bu kullanıcı DM almayı kapatmış.");
      return;
    }

    if (settings?.dnd_mode) {
      toast.error("Bu kullanıcı şu anda rahatsız etmeyin modunda.");
      return;
    }

    const connected = await isConnected(otherUserId);
    if (!connected) {
      toast.error("Mesaj göndermek için önce bağlantı kurmanız gerekiyor.");
      return;
    }

    const { data: existing } = await supabase
      .from("conversations")
      .select("*")
      .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${user.id})`)
      .limit(1);

    const existingConversation = (existing || [])[0] as ConversationRow | undefined;
    if (existingConversation) {
      const isUser1 = existingConversation.user1_id === user.id;
      if (isUser1 && existingConversation.hidden_for_user1) {
        await supabase.from("conversations").update({ hidden_for_user1: false }).eq("id", existingConversation.id);
      }
      if (!isUser1 && existingConversation.hidden_for_user2) {
        await supabase.from("conversations").update({ hidden_for_user2: false }).eq("id", existingConversation.id);
      }
      setActiveConv(existingConversation.id);
      await fetchConversations();
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user1_id: user.id, user2_id: otherUserId, status: "accepted" })
      .select("id")
      .single();

    if (!error && created?.id) {
      setActiveConv(created.id);
      await fetchConversations();
    }
  }, [fetchConversations, isBlocked, isConnected, user]);

  useEffect(() => {
    if (!user) return;
    void fetchConversations();
  }, [fetchConversations, user]);

  useEffect(() => {
    if (!user || !targetUserId || targetUserId === user.id) return;
    void startOrOpenConversation(targetUserId);
  }, [startOrOpenConversation, targetUserId, user]);

  const handleHideConversation = async (conversation: ConversationUI) => {
    if (!user) return;
    const isUser1 = conversation.user1_id === user.id;

    if (isUser1) {
      await supabase.from("conversations").update({ hidden_for_user1: true }).eq("id", conversation.id);
    } else {
      await supabase.from("conversations").update({ hidden_for_user2: true }).eq("id", conversation.id);
    }

    toast.success("Konuşma listeden kaldırıldı.");
    if (activeConv === conversation.id) setActiveConv(null);
    await fetchConversations();
  };

  const handleBlockUser = async (otherUserId: string) => {
    if (!user) return;
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherUserId });
    if (error) return;

    toast.success("Kullanıcı engellendi.");
    const conversation = conversations.find((item) => item.other_user_id === otherUserId);
    if (conversation) {
      const isUser1 = conversation.user1_id === user.id;
      if (isUser1) {
        await supabase.from("conversations").update({ hidden_for_user1: true }).eq("id", conversation.id);
      } else {
        await supabase.from("conversations").update({ hidden_for_user2: true }).eq("id", conversation.id);
      }
    }

    if (activeConv) setActiveConv(null);
    await fetchConversations();
  };

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!user || !activeConv || !newMsg.trim() || sending) return;

    const quickCheck = quickContentCheck(newMsg.trim());
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

      const urlCheck = checkTextUrls(newMsg.trim());
      if (!urlCheck.safe) {
        toast.error(urlCheck.reason || "Mesajınızdaki bağlantı platform kurallarına uygun değil.");
        return;
      }

      const moderation = await moderateText(newMsg.trim(), "direct_message");
      if (!moderation.safe) {
        toast.error(getViolationMessage(moderation.violation_type));
        return;
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConv,
        sender_id: user.id,
        content: newMsg.trim(),
      });
      if (!error) {
        await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeConv);
        setNewMsg("");
        stopTyping();
        await fetchConversations();
      }
    } finally {
      setSending(false);
    }
  };

  const handleUserSelected = (selectedUserId: string) => {
    void startOrOpenConversation(selectedUserId);
  };

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConv) ?? null,
    [activeConv, conversations],
  );

  if (authLoading || !user) return null;

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <Surface variant="soft" border="subtle" padding="md" radius="xl">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <MessageCircle className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-xl font-extrabold tracking-tight">Mesajlar</h1>
              <p className="text-xs text-muted-foreground">DM merkezi: bağlantıdaki kişilerle birebir iletişim kurar, ardından ders bağlamına dönersin.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button asChild size="sm" variant="outline" className="hidden h-8 sm:inline-flex">
                <Link to="/notifications">Bildirimler</Link>
              </Button>
              <UserSearchDialog onUserSelected={handleUserSelected} />
            </div>
          </div>
        </Surface>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[280px_minmax(0,1fr)_260px]" style={{ minHeight: "64vh" }}>
          <Surface
            variant="soft"
            border="subtle"
            padding="none"
            radius="lg"
            className={`overflow-hidden ${activeConv ? "hidden lg:block" : ""}`}
          >
            <div className="flex items-center gap-2 border-b border-border/70 p-3">
              <Link2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">DM Listesi</span>
            </div>
            <div className="max-h-[60vh] divide-y overflow-y-auto">
              {conversations.length > 0 ? (
                conversations.map((conversation) => {
                  const referenceDate = conversation.last_message_at || conversation.created_at || new Date().toISOString();
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => setActiveConv(conversation.id)}
                      className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-secondary/40 ${
                        activeConv === conversation.id ? "bg-primary/10" : ""
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                            {conversation.other_username[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineDot userId={conversation.other_user_id} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{conversation.other_username}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(referenceDate), { addSuffix: true, locale: tr })}
                        </p>
                      </div>
                    </button>
                  );
                })
              ) : (
                <StateBlock
                  variant="empty"
                  size="inline"
                  icon={<Link2Off className="h-4 w-4" />}
                  title="Henüz DM yok"
                  description="Bağlantı kurduğun kullanıcılarla burada sohbet başlatabilirsin."
                  className="m-3"
                />
              )}
            </div>
          </Surface>

          <Surface
            variant="soft"
            border="subtle"
            padding="none"
            radius="lg"
            className={`flex flex-col overflow-hidden ${!activeConv ? "hidden lg:flex" : ""}`}
          >
            {activeConversation ? (
              <>
                <div className="flex items-center gap-3 border-b border-border/70 p-3">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 lg:hidden" onClick={() => setActiveConv(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {activeConversation.other_username[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <OnlineDot userId={activeConversation.other_user_id} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{activeConversation.other_username}</p>
                    {typingUsers.length > 0 ? (
                      <p className="flex items-center gap-1 text-xs text-primary">
                        <span className="flex gap-0.5">
                          <span className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: "0ms" }} />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
                          <span className="h-1 w-1 animate-bounce rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
                        </span>
                        yazıyor...
                      </p>
                    ) : (
                      <OnlineStatusText userId={activeConversation.other_user_id} />
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleHideConversation(activeConversation)}>
                        <EyeOff className="mr-2 h-3.5 w-3.5" /> Konuşmayı Kaldır
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleBlockUser(activeConversation.other_user_id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Ban className="mr-2 h-3.5 w-3.5" /> Kullanıcıyı Engelle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="max-h-[54vh] flex-1 space-y-3 overflow-y-auto bg-background/40 p-4">
                  {messages.map((message) => (
                    <div key={message.id} className={`flex ${message.sender_id === user.id ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          message.sender_id === user.id
                            ? "rounded-br-md bg-primary text-primary-foreground"
                            : "rounded-bl-md bg-secondary"
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{renderMentions(message.content)}</p>
                        <p className={`mt-1 text-xs ${message.sender_id === user.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: tr })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border/70 bg-card/70 p-3">
                  <div className="flex-1">
                    <MentionInput
                      value={newMsg}
                      onChange={(value) => {
                        setNewMsg(value);
                        sendTyping();
                      }}
                      onSubmit={() => handleSend()}
                      placeholder="Mesajınızı yazın..."
                      rows={1}
                      className="min-h-[40px] max-h-[100px] resize-none rounded-xl"
                      maxLength={2000}
                    />
                  </div>
                  <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl" disabled={sending || !newMsg.trim()}>
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
                  title="Bir konuşma seç"
                  description="DM listenden bir sohbet seç veya yeni sohbet başlat."
                />
              </div>
            )}
          </Surface>

          <aside className="hidden space-y-3 lg:flex lg:flex-col">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-sm font-bold">DM Merkezi Rolü</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Mesajlar ekranı birebir iletişim katmanıdır. Kalıcı ders tartışmasının yerini almaz.
              </p>
            </Surface>

            {activeConversation ? (
              <Surface variant="base" border="subtle" padding="md" radius="xl">
                <h2 className="font-heading text-sm font-bold">Aktif Konuşma</h2>
                <p className="mt-1 text-xs text-muted-foreground">{activeConversation.other_username}</p>
                <div className="mt-3 space-y-2">
                  <Button asChild size="sm" className="h-8 w-full">
                    <Link to={`/user/${activeConversation.other_user_id}`}>Profile Git</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 w-full">
                    <Link to="/notifications">Bildirimlere Dön</Link>
                  </Button>
                </div>
              </Surface>
            ) : null}

            <Surface variant="soft" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Bell className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Bağlama Dönüş</p>
              </div>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/notifications">Bildirimler</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/courses">Dersler</Link>
                </Button>
              </div>
            </Surface>
          </aside>
        </div>
      </div>
    </Layout>
  );
}

function OnlineDot({ userId }: { userId: string }) {
  const isOnline = useIsUserOnline(userId);
  return <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />;
}

function OnlineStatusText({ userId }: { userId: string }) {
  const isOnline = useIsUserOnline(userId);
  return <p className={`text-xs ${isOnline ? "text-emerald-500" : "text-muted-foreground"}`}>{isOnline ? "Çevrimiçi" : "Çevrimdışı"}</p>;
}
