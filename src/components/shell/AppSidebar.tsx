import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronUp, GraduationCap, LayoutDashboard, LogOut, Settings, User } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_PRIMARY_ITEMS, type AppNavItem } from "@/components/shell/app-nav";
import { cn } from "@/lib/utils";

function SidebarLink({ item }: { item: AppNavItem }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.exact}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-foreground",
      )}
      activeClassName="bg-primary/10 text-primary"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function AppSidebar() {
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("Hesap");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fallbackName = user.email?.split("@")[0] || "Hesap";
    setDisplayName(fallbackName);

    supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const name = (data as any).display_name || (data as any).username || fallbackName;
        setDisplayName(name);
        setAvatarUrl((data as any).avatar_url || null);
      });
  }, [user]);

  return (
    <aside className="h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col px-3 py-4">
        <Link to="/" className="mb-4 flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-hero">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-heading text-base font-bold tracking-tight">ACATALK</p>
            <p className="text-xs text-muted-foreground">Akademik Sosyal Ağ</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {APP_PRIMARY_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="mt-auto pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-border/80 bg-background px-2 py-2 text-left transition-colors hover:bg-secondary/60"
              >
                <Avatar className="h-8 w-8">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback className="text-xs font-semibold">
                    {displayName.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="text-xs text-muted-foreground">Hesap</p>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onSelect={() => navigate("/profile")} className="gap-2">
                <User className="h-4 w-4" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/settings")} className="gap-2">
                <Settings className="h-4 w-4" />
                Ayarlar
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onSelect={() => navigate("/admin")} className="gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Yönetim Paneli
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void signOut();
                }}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Çıkış Yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}

