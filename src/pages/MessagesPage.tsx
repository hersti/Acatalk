import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format, formatDistanceToNow, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowLeft,
  Ban,
  Bell,
  BookOpen,
  EyeOff,
  Info,
  Link2Off,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Phone,
  Search,
  Send,
  Video,
  Users,
} from "lucide-react";

import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import UserSearchDialog from "@/components/UserSearchDialog";
import MentionInput, { renderMentions } from "@/components/MentionInput";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AppPageHeader,
  HelperCard,
  HelperPanel,
  ListItemCard,
  MetricCard,
  ProductCard,
  ProductEmptyState,
  SectionHeader,
  SplitViewLayout,
} from "@/components/ui/product";
import { toast } from "sonner";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useIsUserOnline } from "@/hooks/useGlobalPresence";
import { fetchDmUnreadOverview, markDmConversationRead } from "@/features/inbox/lib/dm-unread";
import { cn } from "@/lib/utils";

type ConversationRow = Tables<"conversations">;
type MessageRow = Tables<"messages">;
type ProfileMini = Pick<Tables<"profiles">, "user_id" | "username">;
type UserSettingsRow = Pick<Tables<"user_settings">, "dm_allowed" | "dnd_mode">;
type MessagePreviewRow = Pick<Tables<"messages">, "conversation_id" | "content" | "created_at">;

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
  const [conversationPreviewMap, setConversationPreviewMap] = useState<Record<string, string>>({});
  const [conversationMessageCountMap, setConversationMessageCountMap] = useState<Record<string, number>>({});
  const [conversationUnreadMap, setConversationUnreadMap] = useState<Record<string, number>>({});
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [dmSearchQuery, setDmSearchQuery] = useState("");
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
      .then(({ data }) => setMyUsername(data?.username || "KullanÄ±cÄ±"));
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!activeConv) return;
    void fetchMessages(activeConv);
    setConversationUnreadMap((prev) => ({ ...prev, [activeConv]: 0 }));
    void markDmConversationRead(activeConv);

    const channel = supabase
      .channel(`msgs-${activeConv}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConv}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as MessageRow]);
          setConversationUnreadMap((prev) => ({ ...prev, [activeConv]: 0 }));
          void markDmConversationRead(activeConv);
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
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("last_message_at", { ascending: false });

      if (error) {
        throw error;
      }

      const rows = (data || []) as ConversationRow[];
      if (!rows.length) {
        setConversations([]);
        setConversationPreviewMap({});
        setConversationMessageCountMap({});
        setConversationUnreadMap({});
        return;
      }

      const conversationIds = rows.map((conv) => conv.id);
      const otherUserIds = rows.map((conv) => (conv.user1_id === user.id ? conv.user2_id : conv.user1_id));
      const [{ data: profilesData, error: profilesError }, { data: previewRowsData, error: previewError }, unreadOverview] =
        await Promise.all([
          supabase.from("profiles").select("user_id, username").in("user_id", otherUserIds),
          supabase
            .from("messages")
            .select("conversation_id, content, created_at")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false }),
          fetchDmUnreadOverview(),
        ]);

      if (profilesError) {
        throw profilesError;
      }
      if (previewError) {
        throw previewError;
      }

      const profiles = (profilesData || []) as ProfileMini[];
      const previewRows = (previewRowsData || []) as MessagePreviewRow[];
      const profileMap = new Map(profiles.map((item) => [item.user_id, item.username || "Kullanici"]));
      const previewMap: Record<string, string> = {};
      const countMap: Record<string, number> = {};

      for (const row of previewRows) {
        countMap[row.conversation_id] = (countMap[row.conversation_id] || 0) + 1;
        if (!previewMap[row.conversation_id]) {
          previewMap[row.conversation_id] = row.content?.trim() || "";
        }
      }

      const normalized = rows
        .map((conv) => {
          const isUser1 = conv.user1_id === user.id;
          const otherUserId = isUser1 ? conv.user2_id : conv.user1_id;
          const isHidden = isUser1 ? conv.hidden_for_user1 : conv.hidden_for_user2;
          return {
            conv,
            isHidden,
            otherUserId,
            otherUsername: profileMap.get(otherUserId) || "Kullanici",
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
      setConversationPreviewMap(previewMap);
      setConversationMessageCountMap(countMap);
      setConversationUnreadMap(unreadOverview.byConversation);
    } catch (error) {
      toast.error("Mesaj listesi yuklenemedi. Lutfen tekrar deneyin.");
      console.error("fetchConversations failed", error);
    }
  }, [user]);

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Mesajlar yuklenemedi.");
      return;
    }

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
      toast.error("Bu kullanÄ±cÄ±yla mesajlaÅŸma engellendi.");
      return;
    }

    const { data: otherSettings } = await supabase
      .from("user_settings")
      .select("dm_allowed, dnd_mode")
      .eq("user_id", otherUserId)
      .maybeSingle();
    const settings = otherSettings as UserSettingsRow | null;

    if (settings?.dm_allowed === "nobody") {
      toast.error("Bu kullanÄ±cÄ± DM almayÄ± kapatmÄ±ÅŸ.");
      return;
    }

    if (settings?.dnd_mode) {
      toast.error("Bu kullanÄ±cÄ± ÅŸu anda rahatsÄ±z etmeyin modunda.");
      return;
    }

    const connected = await isConnected(otherUserId);
    if (!connected) {
      toast.error("Mesaj gÃ¶ndermek iÃ§in Ã¶nce baÄŸlantÄ± kurmanÄ±z gerekiyor.");
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

    toast.success("KonuÅŸma listeden kaldÄ±rÄ±ldÄ±.");
    if (activeConv === conversation.id) setActiveConv(null);
    await fetchConversations();
  };

  const handleBlockUser = async (otherUserId: string) => {
    if (!user) return;
    const { error } = await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: otherUserId });
    if (error) return;

    toast.success("KullanÄ±cÄ± engellendi.");
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
      toast.error(quickCheck.reason || "Bu mesaj platform kurallarÄ±nÄ± ihlal ediyor.");
      return;
    }

    setSending(true);
    try {
      const status = await checkUserModerationStatus(user.id);
      if (!status.canPost) {
        toast.error(status.reason || "Mesaj gÃ¶ndermeniz engellenmiÅŸtir.");
        return;
      }

      const urlCheck = checkTextUrls(newMsg.trim());
      if (!urlCheck.safe) {
        toast.error(urlCheck.reason || "MesajÄ±nÄ±zdaki baÄŸlantÄ± platform kurallarÄ±na uygun deÄŸil.");
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
      if (error) {
        throw error;
      }

      await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", activeConv);
      setNewMsg("");
      setConversationUnreadMap((prev) => ({ ...prev, [activeConv]: 0 }));
      stopTyping();
      await fetchConversations();
    } catch (error) {
      toast.error("Mesaj gonderilemedi. Lutfen tekrar deneyin.");
      console.error("handleSend failed", error);
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

  const filteredConversations = useMemo(() => {
    const query = dmSearchQuery.trim().toLocaleLowerCase("tr-TR");
    if (!query) return conversations;

    return conversations.filter((conversation) => {
      const username = conversation.other_username.toLocaleLowerCase("tr-TR");
      const preview = (conversationPreviewMap[conversation.id] || "").toLocaleLowerCase("tr-TR");
      return username.includes(query) || preview.includes(query);
    });
  }, [conversations, dmSearchQuery, conversationPreviewMap]);

  const activeConversationPreview = activeConversation ? conversationPreviewMap[activeConversation.id] || "" : "";
  const activeConversationMessageCount = activeConversation ? conversationMessageCountMap[activeConversation.id] || 0 : 0;
  const activeConversationReferenceDate = activeConversation
    ? activeConversation.last_message_at || activeConversation.created_at
    : null;

  if (authLoading || !user) return null;

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <AppPageHeader
          title="Mesajlar"
          description="DM alanı hızlı iletişim katmanıdır. Ana tartışmayı yine ders bağlamında sürdürmek için konuşmaları net, odaklı ve erişilebilir tut."
          icon={<MessageCircle className="h-5 w-5" />}
          actions={
            <>
              <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                <Link to="/notifications">Bildirimler</Link>
              </Button>
              <UserSearchDialog onUserSelected={handleUserSelected} />
            </>
          }
        />

        <SplitViewLayout
          className="h-[calc(100vh-220px)]"
          leftWidth={320}
          rightWidth={320}
          left={
            <div className={cn("flex h-full flex-col", activeConv && "hidden lg:flex")}>
              <div className="border-b border-border/80 bg-gradient-to-b from-card to-card/95 px-4 py-4">
                <SectionHeader
                  title="Sohbet Listesi"
                  description={`${conversations.length} aktif konuşma`}
                  action={
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="hidden h-6 rounded-full px-2 text-[11px] sm:inline-flex">
                        {filteredConversations.length} görünür
                      </Badge>
                      <div className="sm:hidden"><UserSearchDialog onUserSelected={handleUserSelected} /></div>
                    </div>
                  }
                />
                <div className="mt-3 relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={dmSearchQuery}
                    onChange={(event) => setDmSearchQuery(event.target.value)}
                    placeholder="Kişi veya konuşma ara..."
                    className="h-10 rounded-xl border-transparent bg-secondary/70 pl-9 focus:border-border focus:bg-background"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-gradient-to-b from-muted/35 to-background p-2.5">
                {filteredConversations.length > 0 ? (
                  <div className="space-y-2.5">
                    {filteredConversations.map((conversation) => {
                      const referenceDate = conversation.last_message_at || conversation.created_at || new Date().toISOString();
                      const preview = conversationPreviewMap[conversation.id] || "Sohbeti açmak için tıklayın.";
                      const isActive = activeConv === conversation.id;
                      const unreadCount = conversationUnreadMap[conversation.id] || 0;

                      return (
                        <ListItemCard
                          key={conversation.id}
                          onClick={() => {
                            setActiveConv(conversation.id);
                            setConversationUnreadMap((prev) => ({ ...prev, [conversation.id]: 0 }));
                          }}
                          active={isActive}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative mt-0.5">
                              <Avatar className="h-10 w-10 shrink-0 border border-border/70">
                                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                                  {conversation.other_username[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <OnlineDot userId={conversation.other_user_id} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-start justify-between gap-2">
                                <p className="truncate text-sm font-semibold">{conversation.other_username}</p>
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(referenceDate), { addSuffix: true, locale: tr })}
                                  </span>
                                  {unreadCount > 0 ? (
                                    <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                                      {unreadCount > 99 ? "99+" : unreadCount}
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                              <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
                            </div>
                          </div>
                        </ListItemCard>
                      );
                    })}
                  </div>
                ) : dmSearchQuery.trim() ? (
                  <ProductEmptyState
                    icon={<Search className="h-6 w-6" />}
                    title="Arama sonucu yok"
                    description="Arama ifadesini düzenleyip yeniden deneyin."
                    actionLabel="Aramayı temizle"
                    onAction={() => setDmSearchQuery("")}
                    className="mt-6"
                  />
                ) : (
                  <ProductEmptyState
                    icon={<Link2Off className="h-6 w-6" />}
                    title="Henüz DM yok"
                    description="Bağlantı kurduğun kullanıcılarla burada sohbet başlatabilirsin."
                    actionNode={<UserSearchDialog onUserSelected={handleUserSelected} />}
                    className="mt-6"
                  />
                )}
              </div>
            </div>
          }
          main={
            <div className={cn("flex h-full flex-col", !activeConv && "hidden lg:flex")}>
              {activeConversation ? (
                <>
                  <div className="border-b border-border/80 bg-gradient-to-b from-card to-card/95 px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 lg:hidden" onClick={() => setActiveConv(null)}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div className="relative">
                        <Avatar className="h-10 w-10 border border-border/70">
                          <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                            {activeConversation.other_username[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineDot userId={activeConversation.other_user_id} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{activeConversation.other_username}</p>
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
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Sesli arama">
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Görüntülü arama">
                          <Video className="h-4 w-4" />
                        </Button>
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
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-gradient-to-b from-secondary/45 via-background to-background px-4 py-6 sm:px-6">
                    <div className="mx-auto w-full max-w-3xl space-y-3">
                      {messages.length === 0 ? (
                        <ProductEmptyState
                          icon={<MessageCircle className="h-6 w-6" />}
                          title="Bu konuşmada henüz mesaj yok"
                          description="İlk mesajı göndererek konuşmayı başlatabilirsin."
                        />
                      ) : (
                        messages.map((message, index) => {
                          const messageDate = new Date(message.created_at);
                          const previousMessageDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
                          const showDateDivider = !previousMessageDate || !isSameDay(messageDate, previousMessageDate);
                          const isOwnMessage = message.sender_id === user.id;

                          return (
                            <div key={message.id}>
                              {showDateDivider ? (
                                <div className="my-5 flex items-center gap-3">
                                  <div className="h-px flex-1 bg-border/70" />
                                  <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    {format(messageDate, "d MMMM", { locale: tr })}
                                  </span>
                                  <div className="h-px flex-1 bg-border/70" />
                                </div>
                              ) : null}

                              <div className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
                                <div
                                  className={cn(
                                    "max-w-[78%] rounded-2xl border px-4 py-3 shadow-sm",
                                    isOwnMessage
                                      ? "rounded-br-md border-primary bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                                      : "rounded-bl-md border-border/90 bg-card text-foreground shadow-[var(--shadow-soft)]",
                                  )}
                                >
                                  <p className="text-sm leading-relaxed tracking-[0.01em]">{renderMentions(message.content)}</p>
                                  <p className={cn("mt-1 text-[11px]", isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                    {formatDistanceToNow(messageDate, { addSuffix: true, locale: tr })}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="border-t border-border/80 bg-gradient-to-b from-card to-card/95 px-3 py-3 sm:px-4">
                    <form onSubmit={handleSend} className="mx-auto w-full max-w-3xl">
                      <ProductCard className="p-2">
                        <div className="flex items-end gap-2">
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Dosya ekle">
                            <Paperclip className="h-4.5 w-4.5" />
                          </Button>
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
                              className="min-h-[38px] max-h-[110px] resize-none border-0 bg-transparent shadow-none"
                              maxLength={2000}
                            />
                          </div>
                          <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-full" disabled={sending || !newMsg.trim()}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </ProductCard>
                    </form>
                    <p className="mx-auto mt-2 w-full max-w-3xl px-1 text-[11px] text-muted-foreground">
                      Akademik iletişimde saygılı, yapıcı ve bağlamı koruyan bir dil kullanın.
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center p-6 sm:p-8">
                  <ProductEmptyState
                    icon={<MessageCircle className="h-7 w-7" />}
                    title="Mesajlaşmaya başlayın"
                    description="DM listesinden bir sohbet seçin veya yeni konuşma başlatın."
                    actionNode={
                      <div className="flex items-center justify-center gap-2">
                        <UserSearchDialog onUserSelected={handleUserSelected} />
                        <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                          <Link to="/notifications">Bildirimler</Link>
                        </Button>
                      </div>
                    }
                  />
                </div>
              )}
            </div>
          }
          right={
            <HelperPanel className="hidden bg-gradient-to-b from-card to-card/95 lg:block">
              <HelperCard
                title="Konuşma Yardımcısı"
                icon={<Info className="h-4 w-4" />}
                highlighted
              >
                <p className="text-xs leading-relaxed text-muted-foreground">
                  DM hızlı iletişim katmanıdır. Kalıcı tartışmayı ders bağlamına taşımak için gerektiğinde Course Hub'a dön.
                </p>
              </HelperCard>

              {activeConversation ? (
                <>
                  <HelperCard className="bg-gradient-to-b from-card to-secondary/15">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="relative">
                        <Avatar className="h-14 w-14 border border-border/70">
                          <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                            {activeConversation.other_username[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <OnlineDot userId={activeConversation.other_user_id} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{activeConversation.other_username}</p>
                        <OnlineStatusText userId={activeConversation.other_user_id} />
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {activeConversationPreview || "Henüz mesaj önizlemesi yok."}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <MetricCard label="Mesaj" value={activeConversationMessageCount} className="p-3" />
                      <MetricCard
                        label="Son hareket"
                        value={
                          activeConversationReferenceDate
                            ? formatDistanceToNow(new Date(activeConversationReferenceDate), { addSuffix: true, locale: tr })
                            : "-"
                        }
                        className="p-3"
                      />
                    </div>
                  </HelperCard>

                  <HelperCard title="Hızlı İşlemler" icon={<Users className="h-4 w-4" />} highlighted>
                    <div className="space-y-2">
                      <Button asChild size="sm" className="h-8 w-full rounded-lg">
                        <Link to={`/user/${activeConversation.other_user_id}`}>Profili Gör</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 w-full rounded-lg" onClick={() => void handleHideConversation(activeConversation)}>
                        Konuşmayı Kaldır
                      </Button>
                    </div>
                  </HelperCard>
                </>
              ) : (
                <HelperCard>
                  <ProductEmptyState
                    icon={<Info className="h-5 w-5" />}
                    title="Yardım paneli hazır"
                    description="Bir konuşma seçtiğinizde bağlam ve hızlı işlemler burada görünür."
                    className="max-w-none border-none p-0 shadow-none"
                  />
                </HelperCard>
              )}

              <HelperCard title="Bağlama Dönüş" icon={<BookOpen className="h-4 w-4" />} className="bg-gradient-to-b from-card to-secondary/20">
                <div className="space-y-2">
                  <Button asChild size="sm" className="h-8 w-full rounded-lg">
                    <Link to="/notifications">Bildirimler</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 w-full rounded-lg">
                    <Link to="/courses">Dersler</Link>
                  </Button>
                </div>
              </HelperCard>
            </HelperPanel>
          }
        />
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


