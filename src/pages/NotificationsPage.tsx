import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Filter,
  Mail,
  MessageSquare,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StateBlock } from "@/components/ui/state-blocks";
import { Surface } from "@/components/ui/surface";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function StatCard({
  icon: Icon,
  label,
  value,
  colorClass,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <Surface className="p-3 sm:p-4" border="subtle">
      <div className="mb-1.5 flex items-center gap-2">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-opacity-10 ${colorClass}`}>
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
      </div>
      <p className="text-xl font-extrabold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
    </Surface>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    void fetchNotifications(user.id);
  }, [user]);

  const fetchNotifications = async (userId: string) => {
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, message, link, is_read, created_at, user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    setNotifications((data || []) as NotificationRow[]);
    setLoading(false);
  };

  const filtered = useMemo(
    () =>
      notifications.filter((item) => {
        if (filterType !== "all" && item.type !== filterType) return false;
        if (filterRead === "unread" && item.is_read) return false;
        if (filterRead === "read" && !item.is_read) return false;
        return true;
      }),
    [filterRead, filterType, notifications],
  );

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
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
      await supabase.from("notifications").update({ is_read: true }).eq("id", notification.id);
      setNotifications((prev) => prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
    }

    if (notification.link) {
      navigate(notification.link);
    }
  };

  const uniqueTypes = useMemo(() => [...new Set(notifications.map((item) => item.type))], [notifications]);
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const totalCount = notifications.length;

  if (!user) {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl px-4 py-10">
          <StateBlock
            variant="empty"
            size="section"
            title="Bildirimleri görmek için giriş yap"
            description="Hesabına giriş yaptıktan sonra aksiyon kuyruğu bu ekranda görünür."
            primaryAction={
              <Button asChild size="sm">
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
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <Surface variant="soft" border="subtle" padding="md" radius="xl">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-xl font-extrabold tracking-tight">Bildirimler</h1>
              <p className="text-xs text-muted-foreground">Aksiyon merkezi: hangi işi şimdi yapman gerektiğini gösterir ve ilgili hedefe taşır.</p>
            </div>
          </div>
        </Surface>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatCard icon={Bell} label="Toplam" value={totalCount} colorClass="text-primary" />
              <StatCard icon={Mail} label="Okunmamış" value={unreadCount} colorClass="text-destructive" />
              <StatCard icon={CheckCheck} label="Okunmuş" value={totalCount - unreadCount} colorClass="text-emerald-500" />
            </div>

            <Surface variant="base" border="subtle" padding="sm" radius="xl" className="lg:hidden">
              <p className="text-xs font-semibold text-foreground">Hızlı Aksiyonlar</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button size="sm" className="h-8 w-full" onClick={markAllRead} disabled={unreadCount === 0}>
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  Tümünü Okundu Yap
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-full" onClick={deleteAll} disabled={totalCount === 0}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Tümünü Sil
                </Button>
              </div>
            </Surface>

            <Surface variant="base" border="subtle" padding="sm" radius="xl">
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted">
                    <Filter className="h-3 w-3" />
                  </div>
                  Filtre
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 w-full text-xs sm:w-40">
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
                  <SelectTrigger className="h-8 w-full text-xs sm:w-36">
                    <SelectValue placeholder="Durum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="unread">Okunmamış</SelectItem>
                    <SelectItem value="read">Okunmuş</SelectItem>
                  </SelectContent>
                </Select>

                <Badge variant="secondary" className="text-xs sm:ml-auto">
                  {filtered.length} sonuç
                </Badge>
              </div>
            </Surface>

            {loading ? (
              <StateBlock
                variant="loading"
                size="section"
                title="Bildirimler yükleniyor"
                description="Aksiyon listen hazırlanıyor."
              />
            ) : filtered.length === 0 ? (
              <StateBlock
                variant={notifications.length === 0 ? "empty" : "noResults"}
                size="section"
                icon={<Bell className="h-5 w-5" />}
                title={notifications.length === 0 ? "Henüz bildirim yok" : "Filtreye uygun bildirim yok"}
                description={notifications.length === 0 ? "Yeni bildirimler burada görünecek." : "Filtreleri değiştirip tekrar deneyin."}
                primaryAction={
                  notifications.length === 0 ? (
                    <Button asChild size="sm">
                      <Link to="/courses">Derslere Git</Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
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
              <div className="space-y-2">
                {filtered.map((item) => {
                  const Icon = TYPE_ICONS[item.type] || Bell;
                  const typeStyle = TYPE_COLORS[item.type] || "bg-muted text-muted-foreground";

                  return (
                    <Surface
                      key={item.id}
                      variant="soft"
                      border="subtle"
                      padding="none"
                      radius="lg"
                      className={`group relative cursor-pointer transition-colors hover:bg-secondary/50 ${
                        !item.is_read ? "border-primary/30 bg-primary/5" : ""
                      }`}
                      onClick={() => handleNotificationClick(item)}
                    >
                      <div className="flex items-start gap-3 px-4 py-3">
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeStyle}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${typeStyle}`}>
                              {TYPE_LABELS[item.type] || item.type}
                            </span>
                            {!item.is_read ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                          </div>
                          <p className="pr-6 text-sm font-semibold">{item.title}</p>
                          {item.message ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p> : null}
                          <div className="mt-2 flex items-center justify-between">
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
                    </Surface>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="hidden space-y-3 lg:block">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-sm font-bold">Aksiyon Kuyruğu</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Bildirimler ekranı karar sırasını gösterir: önce okunmamışları temizle, sonra ilgili içeriğe geç.
              </p>
              <div className="mt-3 space-y-2">
                <Button size="sm" className="h-8 w-full" onClick={markAllRead} disabled={unreadCount === 0}>
                  <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
                  Tümünü Okundu Yap
                </Button>
                <Button size="sm" variant="outline" className="h-8 w-full" onClick={deleteAll} disabled={totalCount === 0}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Tümünü Sil
                </Button>
              </div>
            </Surface>

            <Surface variant="soft" border="subtle" padding="md" radius="xl">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Bağlama Dönüş</p>
              </div>
              <div className="mt-3 space-y-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/messages">Mesajlara Git</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/courses">Derslere Git</Link>
                </Button>
              </div>
            </Surface>
          </aside>

          <div className="space-y-3 lg:hidden">
            <Surface variant="soft" border="subtle" padding="md" radius="xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bağlama Dönüş</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild size="sm" className="h-8 w-full">
                  <Link to="/messages">Mesajlar</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8 w-full">
                  <Link to="/courses">Dersler</Link>
                </Button>
              </div>
            </Surface>
          </div>
        </div>
      </div>
    </Layout>
  );
}
