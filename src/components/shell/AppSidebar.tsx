import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronUp, GraduationCap, LogOut, Moon, Search, Sun, User } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { APP_INBOX_ITEMS, APP_PRIMARY_ITEMS, APP_SETTINGS_ITEMS, type AppNavItem } from "@/components/shell/app-nav";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  unreadMessages: number;
  unreadNotifications: number;
};

type ProfileSnapshot = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function getBadgeCount(item: AppNavItem, unreadMessages: number, unreadNotifications: number) {
  if (item.badgeKey === "messages") return unreadMessages;
  if (item.badgeKey === "notifications") return unreadNotifications;
  return 0;
}

function SidebarLink({
  item,
  unreadMessages,
  unreadNotifications,
}: {
  item: AppNavItem;
  unreadMessages: number;
  unreadNotifications: number;
}) {
  const Icon = item.icon;
  const badgeCount = getBadgeCount(item, unreadMessages, unreadNotifications);

  return (
    <NavLink
      to={item.to}
      end={item.exact}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors",
        "hover:bg-secondary/75 hover:text-foreground",
      )}
      activeClassName="bg-primary text-primary-foreground shadow-[var(--shadow-soft)] ring-1 ring-primary/35"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {badgeCount > 0 ? (
        <Badge className="ml-auto h-5 min-w-5 rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
          {badgeCount > 99 ? "99+" : badgeCount}
        </Badge>
      ) : null}
    </NavLink>
  );
}

export default function AppSidebar({ unreadMessages, unreadNotifications }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("Hesap");
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

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
        const profile = data as ProfileSnapshot | null;
        if (!profile) return;
        setDisplayName(profile.display_name || profile.username || fallbackName);
        setUsername(profile.username || null);
        setAvatarUrl(profile.avatar_url || null);
      });
  }, [user]);

  useEffect(() => {
    if (!location.pathname.startsWith("/courses")) {
      setQuery("");
      return;
    }

    const params = new URLSearchParams(location.search);
    setQuery(params.get("search") || "");
  }, [location.pathname, location.search]);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
      return;
    }
    if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
      return;
    }
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) {
      navigate(`/courses?search=${encodeURIComponent(value)}`);
    } else {
      navigate("/courses");
    }
  };

  const handleThemeToggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const firstLetter = useMemo(() => displayName.slice(0, 1).toUpperCase(), [displayName]);

  return (
    <aside className="h-screen w-[var(--shell-left-width)] border-r border-border/80 bg-card">
      <div className="flex h-full flex-col px-3 py-4">
        <Link
          to="/"
          className="mb-4 flex items-center gap-2 rounded-xl border border-border/70 bg-background px-2.5 py-2.5 shadow-[var(--shadow-soft)]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-hero">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-bold tracking-tight">ACATALK</p>
            <p className="truncate text-xs text-muted-foreground">Akademik sosyal platform</p>
          </div>
        </Link>

        <form onSubmit={handleSearch} className="mb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ders, icerik veya kisi ara..."
              className="h-10 rounded-xl border-transparent bg-secondary/80 pl-9 text-sm focus:border-border focus:bg-background"
            />
          </div>
        </form>

        <div className="mb-1.5 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kesif</p>
        </div>
        <nav className="rounded-xl border border-border/70 bg-background/70 p-1.5">
          {APP_PRIMARY_ITEMS.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              unreadMessages={unreadMessages}
              unreadNotifications={unreadNotifications}
            />
          ))}
        </nav>

        <div className="mb-1.5 mt-4 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inbox</p>
        </div>
        <nav className="rounded-xl border border-border/70 bg-background/70 p-1.5">
          {APP_INBOX_ITEMS.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              unreadMessages={unreadMessages}
              unreadNotifications={unreadNotifications}
            />
          ))}
        </nav>

        <div className="mb-1.5 mt-4 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hesap</p>
        </div>
        <nav className="rounded-xl border border-border/70 bg-background/70 p-1.5">
          {APP_SETTINGS_ITEMS.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              unreadMessages={unreadMessages}
              unreadNotifications={unreadNotifications}
            />
          ))}
        </nav>

        <div className="mt-auto border-t border-border/70 pt-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-border/80 bg-background px-2.5 py-2.5 text-left transition-colors hover:bg-secondary/60"
              >
                <Avatar className="h-8 w-8">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
                  <AvatarFallback className="text-xs font-semibold">{firstLetter}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="text-xs text-muted-foreground">@{username || "hesap"}</p>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56">
              <DropdownMenuItem onSelect={() => navigate("/profile")} className="gap-2">
                <User className="h-4 w-4" />
                Profil
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handleThemeToggle();
                }}
                className="gap-2"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? "Acik tema" : "Koyu tema"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  void signOut();
                }}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Cikis yap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </aside>
  );
}
