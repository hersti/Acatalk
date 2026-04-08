import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import MentionInput from "@/components/MentionInput";
import { RenderMentions } from "@/components/MentionRenderer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { BookOpen, Globe, Hash, MessageCircle, Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { moderateText, checkUserModerationStatus, getViolationMessage } from "@/lib/moderation";
import { checkTextUrls } from "@/lib/moderate-url";
import { quickContentCheck } from "@/lib/profanity-filter";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { TypingIndicator } from "@/components/TypingIndicator";
import {
  buildCommunityDefinitions,
  CHANNELS,
  DEFAULT_COMMUNITIES,
  DEFAULT_MESSAGE_CONTEXT,
  encodeCommunityMessageTags,
  extractCommunityMessageContext,
  isChannelId,
  isCommunityId,
  stripCommunityMessageTags,
  type ChannelId,
  type CommunityDef,
} from "@/lib/community-message-context";
import { AppPageHeader, HelperCard, HelperPanel, PageTabsBar, ProductCard, ProductEmptyState, SplitViewLayout } from "@/components/ui/product";

interface CommunityMsg {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username?: string;
}

function isCommunityMsg(value: unknown): value is CommunityMsg {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.user_id === "string" &&
    typeof record.content === "string" &&
    typeof record.created_at === "string"
  );
}

function getDeletedMessageId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" ? record.id : null;
}

export default function CommunityPage() {
  const { id } = useParams<{ id?: string }>();
  const { user, isAdmin } = useAuth();
  const [communities, setCommunities] = useState<CommunityDef[]>(DEFAULT_COMMUNITIES);

  const initialCommunity = useMemo(() => {
    const routeId = (id || "").toLowerCase();
    if (isCommunityId(routeId) && communities.some((item) => item.id === routeId)) return routeId;
    return DEFAULT_MESSAGE_CONTEXT.community;
  }, [communities, id]);

  const [selectedCommunity, setSelectedCommunity] = useState(initialCommunity);
  const [selectedChannel, setSelectedChannel] = useState<ChannelId>(DEFAULT_MESSAGE_CONTEXT.channel);
  const [messages, setMessages] = useState<CommunityMsg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [myUsername, setMyUsername] = useState<string>();
  const onlineCount = useOnlinePresence(`community-presence-${selectedCommunity}`, user?.id);

  const typingNamespace = `community-${selectedCommunity}-${selectedChannel}`;
  const { typingUsers, sendTyping, stopTyping } = useTypingIndicator(typingNamespace, user?.id, myUsername);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    setSelectedCommunity(initialCommunity);
  }, [initialCommunity]);

  useEffect(() => {
    if (!user) {
      setCommunities(buildCommunityDefinitions());
      return;
    }

    supabase
      .from("profiles")
      .select("username, university, department")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMyUsername(data?.username || "Kullanıcı");
        setCommunities(buildCommunityDefinitions(data?.university, data?.department));
      });
  }, [user]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("community_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(400);

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((item) => item.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username").in("user_id", userIds);
      const profileMap = new Map(profiles?.map((item) => [item.user_id, item.username]) || []);
      const normalizedMessages: CommunityMsg[] = data.map((item) => ({
        id: item.id,
        user_id: item.user_id,
        content: item.content,
        created_at: item.created_at,
        username: profileMap.get(item.user_id) || "Kullanıcı",
      }));
      setMessages(normalizedMessages);
    } else {
      setMessages([]);
    }

    setTimeout(() => {
      initialLoadDone.current = true;
    }, 120);
  }, []);

  useEffect(() => {
    void fetchMessages();

    const channel = supabase
      .channel("community-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_messages" }, async (payload) => {
        if (!isCommunityMsg(payload.new)) return;
        const msg = payload.new;
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", msg.user_id)
          .maybeSingle();
        setMessages((prev) => [...prev, { ...msg, username: profile?.username || "Kullanıcı" }]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "community_messages" }, (payload) => {
        const deletedId = getDeletedMessageId(payload.old);
        if (!deletedId) return;
        setMessages((prev) => prev.filter((item) => item.id !== deletedId));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages]);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChannel, selectedCommunity]);

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      const tags = extractCommunityMessageContext(message.content || "");
      return tags.community === selectedCommunity && tags.channel === selectedChannel;
    });
  }, [messages, selectedChannel, selectedCommunity]);

  const channelCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const msg of messages) {
      const tags = extractCommunityMessageContext(msg.content || "");
      if (tags.community !== selectedCommunity) continue;
      map.set(tags.channel, (map.get(tags.channel) || 0) + 1);
    }
    return map;
  }, [messages, selectedCommunity]);

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!user || !newMsg.trim() || sending) return;

    const payload = newMsg.trim();
    const quickCheck = quickContentCheck(payload);
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

    const urlCheck = checkTextUrls(payload);
    if (!urlCheck.safe) {
      toast.error(urlCheck.reason || "Mesajdaki bağlantı kurallara uygun değil.");
      setSending(false);
      return;
    }

    const modResult = await moderateText(payload, "community_message");
    if (!modResult.safe) {
      toast.error(getViolationMessage(modResult.violation_type));
      setSending(false);
      return;
    }

    const contentWithTags = `${encodeCommunityMessageTags(selectedCommunity, selectedChannel)} ${payload}`;
    const { error } = await supabase.from("community_messages").insert({ user_id: user.id, content: contentWithTags });

    if (error) toast.error("Gönderilemedi");
    else {
      setNewMsg("");
      stopTyping();
    }

    setSending(false);
  };

  const handleDelete = async (msgId: string) => {
    await supabase.from("community_messages").delete().eq("id", msgId);
  };

  const channelTabs = CHANNELS.map((channel) => ({ key: channel.id, label: channel.label, count: channelCounts.get(channel.id) || 0 }));
  const selectedCommunityMeta = communities.find((item) => item.id === selectedCommunity) || communities[0];

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <AppPageHeader
          title="Topluluklar"
          description="Çoklu community/channel hissi, mevcut community_messages veri modeli korunarak görünüm katmanında sağlanır."
          icon={<Users className="h-5 w-5" />}
          actions={
            <>
              <Button asChild size="sm" variant="outline" className="h-9 rounded-xl">
                <Link to="/courses">Course Hub'a Dön</Link>
              </Button>
              <Badge variant="secondary" className="h-9 rounded-xl px-3 text-xs">
                {onlineCount} çevrimiçi
              </Badge>
            </>
          }
        />

        <SplitViewLayout
          className="h-[calc(100vh-206px)]"
          leftWidth={292}
          rightWidth={324}
          left={
            <div className="h-full border-r border-border/70 bg-gradient-to-b from-card to-card/95 p-2.5">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Topluluklar</p>
              <div className="space-y-1.5">
                {communities.map((community) => {
                  const isActive = community.id === selectedCommunity;
                  return (
                    <button
                      key={community.id}
                      type="button"
                      onClick={() => setSelectedCommunity(community.id)}
                      className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                        isActive
                          ? "border-primary/50 bg-gradient-to-r from-primary/14 via-primary/5 to-background shadow-[var(--shadow-card)] ring-1 ring-primary/20"
                          : "border-border/70 bg-background hover:border-primary/25 hover:bg-background/95"
                      }`}
                    >
                      <p className="text-xs font-semibold">{community.label}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{community.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          }
          main={
            <div className="flex h-full flex-col bg-gradient-to-b from-secondary/40 to-background">
              <div className="border-b border-border/70 bg-card/90 px-3.5 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedCommunityMeta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{selectedCommunityMeta.description}</p>
                  </div>
                </div>
                <PageTabsBar
                  items={channelTabs}
                  value={selectedChannel}
                  onChange={(value) => {
                    if (isChannelId(value)) setSelectedChannel(value);
                  }}
                />
              </div>

              <div className="flex-1 overflow-y-auto px-3.5 py-3">
                {filteredMessages.length === 0 ? (
                  <ProductEmptyState
                    icon={<MessageCircle className="h-6 w-6" />}
                    title="Bu kanalda henüz mesaj yok"
                    description="Sohbeti başlatmak için ilk mesajı gönderebilirsin."
                  />
                ) : (
                  <div className="space-y-1.5">
                    {filteredMessages.map((message) => {
                      const isOwn = message.user_id === user?.id;
                      return (
                        <ProductCard key={message.id} className="p-2.5">
                          <div className={`flex items-start gap-2.5 ${isOwn ? "justify-end" : ""}`}>
                            {!isOwn ? (
                              <Avatar className="h-8 w-8 shrink-0 border border-border/60">
                                <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                                  {(message.username || "?")[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : null}
                            <div className={`min-w-0 ${isOwn ? "text-right" : ""}`}>
                              <div className="mb-1 flex items-center gap-1.5">
                                <span className="text-xs font-semibold">{message.username}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: tr })}
                                </span>
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(message.id)}
                                    className="text-[10px] font-semibold text-destructive"
                                  >
                                    Sil
                                  </button>
                                ) : null}
                              </div>
                              <p className={`text-sm leading-relaxed ${isOwn ? "inline-block rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground shadow-[var(--shadow-soft)]" : "text-foreground"}`}>
                                <RenderMentions text={stripCommunityMessageTags(message.content)} />
                              </p>
                            </div>
                          </div>
                        </ProductCard>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {user ? (
                <div className="border-t border-border/70 bg-card/90 px-3 py-2.5">
                  <TypingIndicator typingUsers={typingUsers} />
                  <form onSubmit={handleSend} className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <MentionInput
                        value={newMsg}
                        onChange={(value) => {
                          setNewMsg(value);
                          sendTyping();
                        }}
                        onSubmit={() => void handleSend()}
                        placeholder={`#${selectedChannel} kanalına mesaj yaz...`}
                        rows={1}
                        className="min-h-[38px] max-h-[100px] resize-none rounded-xl border-border/60"
                        maxLength={1000}
                      />
                    </div>
                    <Button type="submit" size="icon" className="h-9 w-9 rounded-xl" disabled={sending || !newMsg.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="border-t border-border/70 bg-card/85 p-3 text-center text-xs text-muted-foreground">
                  Mesaj göndermek için <Link to="/auth" className="font-semibold text-primary">giriş yapın</Link>.
                </div>
              )}
            </div>
          }
          right={
            <HelperPanel className="hidden bg-gradient-to-b from-card to-card/95 lg:block">
              <HelperCard title="Community UX Layer" icon={<Sparkles className="h-4 w-4" />} highlighted>
                <p className="text-xs text-muted-foreground">
                  Çoklu community ve kanal hissi UI katmanında oluşturulur; veri kaynağı tek ve güvenli kalır.
                </p>
              </HelperCard>

              <HelperCard title="Seçili Kanal" icon={<Hash className="h-4 w-4" />}>
                <p className="text-sm font-semibold">{CHANNELS.find((channel) => channel.id === selectedChannel)?.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CHANNELS.find((channel) => channel.id === selectedChannel)?.description}
                </p>
                <div className="mt-2 rounded-lg bg-secondary/60 px-2.5 py-2 text-[11px] text-muted-foreground">
                  Mesaj: {filteredMessages.length}
                </div>
              </HelperCard>

              <HelperCard title="Bağlama Dönüş" icon={<BookOpen className="h-4 w-4" />}>
                <div className="space-y-2">
                  <Button asChild size="sm" className="h-8 w-full rounded-lg">
                    <Link to="/courses">Derslere Git</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8 w-full rounded-lg">
                    <Link to="/messages">Mesajlar</Link>
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
