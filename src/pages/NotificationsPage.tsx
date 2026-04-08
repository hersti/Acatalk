import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertCircle,
  Bell,
  BookOpen,
  CheckCheck,
  Filter,
  Mail,
  MessageSquare,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateBlock } from "@/components/ui/state-blocks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AppPageHeader,
  HelperCard,
  HelperPanel,
  MetricCard,
  PageTabsBar,
  ProductCard,
  ProductEmptyState,
} from "@/components/ui/product";
import { toast } from "sonner";

type NotificationRow = Pick<
  Tables<"notifications">,
  "id" | "type" | "title" | "message" | "link" | "is_read" | "created_at" | "user_id"
>;

const TYPE_LABELS: Record<string, string> = {
  reply: "Yanıt",
  mention: "Etiket",
  follow_upload: "Takip İçeriği",
  follow: "Takip",
  connection_request: "Bağlantı İsteği",
  moderation: "Moderasyon",
  system: "Sistem",
  vote: "Oy",
};

const TYPE_COLORS: Record<string, string> = {
  reply: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  mention: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  follow_upload: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  follow: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  connection_request: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  moderation: "bg-red-500/10 text-red-600 dark:text-red-400",
  system: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  vote: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

const TYPE_ICONS: Record<string, LucideIcon> = {
  reply: MessageSquare,
  mention: Mail,
  moderation: AlertCircle,
  system: Bell,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "mentions" | "courses" | "social">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    void fetchNotifications(user.id);
  }, [user]);

  const fetchNotifications = async (userId: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, message, link, is_read, created_at, user_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        throw error;
      }

      setNotifications((data || []) as NotificationRow[]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Bildirim listesi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          void fetchNotifications(user.id);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filtered = useMemo(
    () =>
      notifications.filter((item) => {
        if (activeTab === "mentions" && item.type !== "mention") return false;
        if (activeTab === "courses" && !["reply", "vote", "follow_upload"].includes(item.type)) return false;
        if (activeTab === "social" && !["follow", "connection_request", "mention"].includes(item.type)) return false;
        if (filterType !== "all" && item.type !== filterType) return false;
        if (filterRead === "unread" && item.is_read) return false;
        if (filterRead === "read" && !item.is_read) return false;
        return true;
      }),
    [activeTab, filterRead, filterType, notifications],
  );

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      toast.error("Bildirimler okundu durumuna alinamadi.");
      return;
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    toast.success("Tüm bildirimler okundu olarak işaretlendi.");
  };

  const deleteOne = async (event: React.MouseEvent, notificationId: string) => {
    event.stopPropagation();
    const { error } = await supabase.from("notifications").delete().eq("id", notificationId);
    if (error) {
      toast.error("Bildirim silinemedi.");
      return;
    }
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));
  };

  const deleteAll = async () => {
    if (!user) return;
    const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
    if (error) {
      toast.error("Bildirimler silinemedi.");
      return;
    }
    setNotifications([]);
    toast.success("Tüm bildirimler silindi.");
  };

  const handleNotificationClick = async (notification: NotificationRow) => {
    if (!notification.is_read) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notification.id);

      if (error) {
        toast.error("Bildirim durumu guncellenemedi.");
        return;
      }

      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  const uniqueTypes = useMemo(() => [...new Set(notifications.map((item) => item.type))], [notifications]);
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const totalCount = notifications.length;
  const actionRequiredCount = notifications.filter((item) => !item.is_read && ["mention", "reply", "connection_request"].includes(item.type)).length;

  const tabItems = [
    { key: "all", label: "Tümü", count: notifications.length },
    { key: "mentions", label: "Etiketler", count: notifications.filter((item) => item.type === "mention").length },
    {
      key: "courses",
      label: "Ders",
      count: notifications.filter((item) => ["reply", "vote", "follow_upload"].includes(item.type)).length,
    },
    {
      key: "social",
      label: "Sosyal",
      count: notifications.filter((item) => ["follow", "connection_request", "mention"].includes(item.type)).length,
    },
  ];

  if (!user) {
    return (
      <Layout>
        <div className="app-page-wrap">
          <ProductEmptyState
            icon={<Bell className="h-6 w-6" />}
            title="Bildirimleri görmek için giriş yap"
            description="Hesabına giriş yaptıktan sonra aksiyon kuyruğu burada görünür."
            actionNode={
              <Button asChild size="sm" className="h-9 rounded-xl">
                <Link to="/auth">Giriş Yap</Link>
              </Button>
            }
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="app-page-wrap page-section-stack">
        <AppPageHeader
          title="Bildirimler"
          description="Aksiyon merkezi: önce kritik bildirimleri temizle, sonra ilgili hedefe geç ve akışı kapat."
          icon={<Bell className="h-5 w-5" />}
          actions={
            <>
              <Button size="sm" className="h-9 rounded-xl" onClick={markAllRead} disabled={unreadCount === 0}>
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                Tümünü Okundu Yap
              </Button>
              <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={deleteAll} disabled={totalCount === 0}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Tümünü Sil
              </Button>
            </>
          }
          tabs={<PageTabsBar items={tabItems} value={activeTab} onChange={(next) => setActiveTab(next as typeof activeTab)} />}
        />

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[minmax(0,1fr)_336px]">
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label="Toplam" value={totalCount} icon={<Bell className="h-4 w-4" />} />
              <MetricCard label="Okunmamış" value={unreadCount} icon={<Mail className="h-4 w-4" />} />
              <MetricCard label="Okunmuş" value={totalCount - unreadCount} icon={<CheckCheck className="h-4 w-4" />} />
            </div>

            <ProductCard className="bg-gradient-to-b from-card to-secondary/20 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary">
                    <Filter className="h-3 w-3" />
                  </div>
                  Filtre
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:w-44">
                    <SelectValue placeholder="Tür" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm türler</SelectItem>
                    {uniqueTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {TYPE_LABELS[type] || type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterRead} onValueChange={setFilterRead}>
                  <SelectTrigger className="h-9 w-full rounded-xl text-xs sm:w-36">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="unread">Okunmamış</SelectItem>
                    <SelectItem value="read">Okunmuş</SelectItem>
                  </SelectContent>
                </Select>

                <Badge variant="secondary" className="h-7 rounded-full px-2.5 text-xs sm:ml-auto">
                  {filtered.length} sonuç
                </Badge>
              </div>
            </ProductCard>

            {actionRequiredCount > 0 ? (
              <ProductCard highlighted className="p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Aksiyon gerekli</p>
                    <p className="text-xs text-muted-foreground">
                      {actionRequiredCount} bildirim yanit veya kontrol bekliyor.
                    </p>
                  </div>
                </div>
              </ProductCard>
            ) : null}

            {loading ? (
              <StateBlock variant="loading" size="section" title="Bildirimler yükleniyor" description="Aksiyon listen hazırlanıyor." />
            ) : loadError ? (
              <StateBlock
                variant="error"
                size="section"
                title="Bildirimler alinamadi"
                description="Sunucuya ulasilamadi veya yetki hatasi olustu."
                secondaryAction={
                  <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => void fetchNotifications(user.id)}>
                    Yeniden dene
                  </Button>
                }
              />
            ) : filtered.length === 0 ? (
              <ProductEmptyState
                icon={<Bell className="h-6 w-6" />}
                title={notifications.length === 0 ? "Henüz bildirim yok" : "Filtreye uygun bildirim yok"}
                description={notifications.length === 0 ? "Yeni bildirimler burada görünecek." : "Filtreleri değiştirip tekrar deneyin."}
                actionNode={
                  notifications.length === 0 ? (
                    <Button asChild size="sm" className="h-9 rounded-xl">
                      <Link to="/courses">Derslere Git</Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-xl"
                      onClick={() => {
                        setFilterType("all");
                        setFilterRead("all");
                      }}
                    >
                      Filtreleri Temizle
                    </Button>
                  )
                }
              />
            ) : (
              <ProductCard className="bg-gradient-to-b from-card to-secondary/20 p-1.5">
                <div className="space-y-1.5">
                  {filtered.map((item) => {
                    const Icon = TYPE_ICONS[item.type] || Bell;
                    const typeStyle = TYPE_COLORS[item.type] || "bg-muted text-muted-foreground";

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`group w-full rounded-xl border px-3 py-2.5 text-left transition-all hover:bg-secondary/45 ${
                          !item.is_read
                            ? "border-primary/55 bg-gradient-to-r from-primary/14 via-primary/6 to-card shadow-[var(--shadow-card)] ring-1 ring-primary/30"
                            : "border-border/70 bg-card hover:border-primary/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${typeStyle}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${typeStyle}`}>
                                {TYPE_LABELS[item.type] || item.type}
                              </span>
                              {!item.is_read ? <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]" /> : null}
                            </div>
                             <p className="pr-6 text-sm font-semibold leading-snug tracking-[0.01em]">{item.title}</p>
                             {item.message ? <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground/95">{item.message}</p> : null}
                             <div className="mt-1.5 flex items-center justify-between">
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: tr })}
                              </p>
                              {item.link ? <p className="text-[11px] font-semibold text-primary">İlgili hedefe git</p> : null}
                            </div>
                          </div>
                          <button
                            onClick={(event) => deleteOne(event, item.id)}
                            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                            aria-label="Bildirimi sil"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ProductCard>
            )}
          </div>

          <HelperPanel className="hidden bg-gradient-to-b from-card to-card/95 lg:block">
            <HelperCard title="Aksiyon Kuyruğu" icon={<CheckCheck className="h-4 w-4" />} highlighted>
              <p className="text-xs text-muted-foreground">
                Önce okunmamışları temizle, sonra bildirimlerin götürdüğü hedeflere gidip akışı tamamla.
              </p>
              <div className="mt-2.5 space-y-2">
                <Button size="sm" className="h-8 w-full rounded-lg" onClick={markAllRead} disabled={unreadCount === 0}>
                  Tümünü Okundu Yap
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-full rounded-lg" onClick={deleteAll} disabled={totalCount === 0}>
                  Tümünü Sil
                </Button>
              </div>
            </HelperCard>

            <HelperCard title="Öncelik Özeti" icon={<AlertCircle className="h-4 w-4" />} className="bg-gradient-to-b from-card to-secondary/15">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Okunmamış</span>
                  <span className="font-semibold text-foreground">{unreadCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Toplam Bildirim</span>
                  <span className="font-semibold text-foreground">{totalCount}</span>
                </div>
                <div className="pt-1">
                  <Badge variant="secondary" className="text-[11px]">
                    {unreadCount > 0 ? "Aksiyon gerekli" : "Akış temiz"}
                  </Badge>
                </div>
              </div>
            </HelperCard>

            <HelperCard title="Bağlama Dönüş" icon={<BookOpen className="h-4 w-4" />} className="bg-gradient-to-b from-card to-secondary/20">
              <div className="space-y-2">
                <Button asChild size="sm" className="h-8 w-full rounded-lg">
                  <Link to="/messages">Mesajlara Git</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full rounded-lg">
                  <Link to="/courses">Derslere Git</Link>
                </Button>
              </div>
            </HelperCard>
          </HelperPanel>
        </div>
      </div>
    </Layout>
  );
}
