import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronUp, GraduationCap, LayoutDashboard, LogOut, Moon, Search, Settings, Sun, User } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { NavLink } from "@/components/NavLink";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
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
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("Hesap");
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
        if (!data) return;
        const name = data.display_name || data.username || fallbackName;
        setDisplayName(name);
        setAvatarUrl(data.avatar_url || null);
      });
  }, [user]);

  useEffect(() => {
    if (location.pathname !== "/courses") {
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

        <form onSubmit={handleSearch} className="mb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ders, içerik veya kullanıcı ara..."
              className="h-9 rounded-lg border-transparent bg-muted pl-9 text-sm focus:border-border focus:bg-background"
            />
          </div>
        </form>

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
                  <AvatarFallback className="text-xs font-semibold">{displayName.slice(0, 1).toUpperCase()}</AvatarFallback>
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
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  handleThemeToggle();
                }}
                className="gap-2"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {isDark ? "Açık Tema" : "Koyu Tema"}
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
