import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { APP_MOBILE_ITEMS } from "@/components/shell/app-nav";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  unreadMessages: number;
  unreadNotifications: number;
};

function resolveBadgeCount(itemKey: string, unreadMessages: number, unreadNotifications: number) {
  if (itemKey === "messages") return unreadMessages;
  if (itemKey === "notifications") return unreadNotifications;
  return 0;
}

export default function MobileBottomNav({ unreadMessages, unreadNotifications }: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex h-[4.4rem] max-w-xl items-center justify-between px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
        {APP_MOBILE_ITEMS.map((item) => {
          const Icon = item.icon;
          const badgeCount = resolveBadgeCount(item.key, unreadMessages, unreadNotifications);

          return (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.exact}
              className={cn(
                "relative flex min-w-[4.1rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors",
                "hover:text-foreground",
              )}
              activeClassName="bg-primary/10 text-primary"
            >
              <span className="relative">
                <Icon className="h-4.5 w-4.5" />
                {badgeCount > 0 ? (
                  <Badge
                    className={cn(
                      "absolute -right-2.5 -top-2 h-4 min-w-4 rounded-full px-1 text-[9px] font-bold",
                      "bg-primary text-primary-foreground",
                    )}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </Badge>
                ) : null}
              </span>
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
