import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", oneWeekAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) || []);
  }, [user]);

  useEffect(() => {
    if (user) void fetchNotifications();
  }, [fetchNotifications, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
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
    if (notif.link) {
      navigate(notif.link);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl relative" aria-label="Bildirimler">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[9px] text-destructive-foreground flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 border-border/70" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/70">
          <h3
            className="text-sm font-bold cursor-pointer hover:text-primary transition-colors"
            onClick={() => { setOpen(false); navigate("/notifications"); }}
          >
            Bildirimler
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-primary hover:underline font-medium">
                Okundu işaretle
              </button>
            )}
            {notifications.length > 0 && (
              <button onClick={deleteAll} className="text-[11px] text-destructive hover:underline font-medium flex items-center gap-0.5">
                <Trash2 className="h-3 w-3" />
                Tümünü sil
              </button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Bildirim yok.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`relative group w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer ${!n.is_read ? "bg-primary/5" : ""}`}
                  onClick={() => handleClick(n)}
                >
                  <button
                    onClick={(e) => deleteOne(e, n.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    aria-label="Bildirimi sil"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <p className="text-xs font-semibold pr-5">{n.title}</p>
                  {n.message && <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: tr })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
