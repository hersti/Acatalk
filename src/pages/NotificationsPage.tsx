import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Trash2, X, Filter, CheckCheck, Mail, AlertCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Layout from "@/components/Layout";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

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

const TYPE_ICONS: Record<string, typeof Bell> = {
  reply: MessageSquare,
  mention: Mail,
  moderation: AlertCircle,
  system: Bell,
};

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`h-8 w-8 rounded-lg ${color} bg-opacity-10 flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground font-medium mt-0.5">{label}</p>
    </Card>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRead, setFilterRead] = useState<string>("all");

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    setNotifications((data as Notification[]) || []);
    setLoading(false);
  };

  const filtered = notifications.filter((n) => {
    if (filterType !== "all" && n.type !== filterType) return false;
    if (filterRead === "unread" && n.is_read) return false;
    if (filterRead === "read" && !n.is_read) return false;
    return true;
  });

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast.success("Tüm bildirimler okundu olarak işaretlendi");
  };

  const deleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) { toast.error("Silinemedi"); return; }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const deleteAll = async () => {
    if (!user) return;
    const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);
    if (error) { toast.error("Bildirimler silinemedi"); return; }
    setNotifications([]);
    toast.success("Tüm bildirimler silindi");
  };

  const handleClick = async (notif: Notification) => {
    if (!notif.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
      setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (notif.link) navigate(notif.link);
  };

  const uniqueTypes = [...new Set(notifications.map((n) => n.type))];
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const totalCount = notifications.length;

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Bildirimleri görmek için giriş yapın.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Header - Admin Panel Style */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-extrabold tracking-tight">Bildirimler</h1>
            <p className="text-[11px] text-muted-foreground">Tüm bildirimlerinizi yönetin</p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="text-xs gap-1 h-8">
                <CheckCheck className="h-3.5 w-3.5" />
                Tümü okundu
              </Button>
            )}
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={deleteAll} className="text-xs gap-1 h-8 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
                Tümünü sil
              </Button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Bell} label="Toplam" value={totalCount} color="text-primary" />
          <StatCard icon={Mail} label="Okunmamış" value={unreadCount} color="text-destructive" />
          <StatCard icon={CheckCheck} label="Okunmuş" value={totalCount - unreadCount} color="text-emerald-500" />
        </div>

        {/* Filters - Admin Panel Style */}
        <Card className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                <Filter className="h-3 w-3" />
              </div>
              Filtrele:
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Tür" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm türler</SelectItem>
                {uniqueTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRead} onValueChange={setFilterRead}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Durum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="unread">Okunmamış</SelectItem>
                <SelectItem value="read">Okunmuş</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="ml-auto text-[10px]">{filtered.length} sonuç</Badge>
          </div>
        </Card>

        {/* List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground mt-2">Yükleniyor...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 rounded-lg bg-muted/30">
            <Bell className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground mb-1">
              {notifications.length === 0 ? "Henüz bildirim yok" : "Filtreye uygun bildirim bulunamadı"}
            </p>
            <p className="text-xs text-muted-foreground">Yeni bildirimler burada görünecek.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => {
              const NotifIcon = TYPE_ICONS[n.type] || Bell;
              return (
                <Card
                  key={n.id}
                  className={`relative group cursor-pointer transition-colors hover:bg-secondary/50 ${!n.is_read ? "border-primary/30 bg-primary/5" : ""}`}
                  onClick={() => handleClick(n)}
                >
                  <div className="px-4 py-3 flex items-start gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${TYPE_COLORS[n.type] || "bg-muted"}`}>
                      <NotifIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[n.type] || "bg-muted text-muted-foreground"}`}>
                          {TYPE_LABELS[n.type] || n.type}
                        </span>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm font-semibold pr-6">{n.title}</p>
                      {n.message && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: tr })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteOne(e, n.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Bildirimi sil"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
