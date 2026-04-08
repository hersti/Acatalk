import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Menu, MessageCircle, Moon, Search, Sun, User } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import { APP_INBOX_ITEMS, APP_PRIMARY_ITEMS, APP_SETTINGS_ITEMS, getShellTitle } from "@/components/shell/app-nav";
import { cn } from "@/lib/utils";

type AppTopbarProps = {
  unreadMessages: number;
  unreadNotifications: number;
};

function getBadge(itemKey: string, unreadMessages: number, unreadNotifications: number) {
  if (itemKey === "messages") return unreadMessages;
  if (itemKey === "notifications") return unreadNotifications;
  return 0;
}

export default function AppTopbar({ unreadMessages, unreadNotifications }: AppTopbarProps) {
  const { isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

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

  const shellTitle = useMemo(() => getShellTitle(location.pathname), [location.pathname]);
  const showSearch = location.pathname.startsWith("/courses");

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) {
      navigate(`/courses?search=${encodeURIComponent(value)}`);
    } else {
      navigate("/courses");
    }
  };

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-[var(--shell-topbar-height)] w-full items-center gap-3 px-4 sm:px-5 lg:px-7">
        <div className="lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[320px] p-0">
              <SheetHeader className="border-b border-border px-4 py-3 text-left">
                <SheetTitle className="font-heading text-base">Menu</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Kesif</p>
                  <div className="flex flex-col gap-1">
                    {APP_PRIMARY_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            navigate(item.to);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inbox</p>
                  <div className="flex flex-col gap-1">
                    {APP_INBOX_ITEMS.map((item) => {
                      const Icon = item.icon;
                      const badgeCount = getBadge(item.key, unreadMessages, unreadNotifications);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            navigate(item.to);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                          {badgeCount > 0 ? (
                            <Badge className="ml-auto h-5 min-w-5 rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                              {badgeCount > 99 ? "99+" : badgeCount}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <div className="flex flex-col gap-1">
                    {APP_SETTINGS_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            navigate(item.to);
                            setMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        navigate("/profile");
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <User className="h-4 w-4" />
                      Profil
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          navigate("/admin");
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        Admin
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        toggleTheme();
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {isDark ? "Acik tema" : "Koyu tema"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void signOut();
                        setMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" />
                      Cikis yap
                    </button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="min-w-0 flex-1">
          <div className="hidden items-center gap-3 lg:flex">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{shellTitle.title}</p>
              <p className="truncate text-xs text-muted-foreground">{shellTitle.description}</p>
            </div>
          </div>
          <div className="lg:hidden">
            <p className="truncate text-sm font-semibold text-foreground">{shellTitle.title}</p>
          </div>
        </div>

        {showSearch ? (
          <form onSubmit={handleSearch} className="hidden w-full max-w-md flex-1 lg:block">
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
        ) : (
          <div className="hidden lg:block lg:flex-1" />
        )}

        <div className="flex items-center gap-1.5">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className={cn("relative h-9 w-9 rounded-xl", location.pathname.startsWith("/messages") && "bg-primary/10 text-primary")}
            aria-label="Mesajlar"
          >
            <Link to="/messages">
              <MessageCircle className="h-4 w-4" />
              {unreadMessages > 0 ? (
                <Badge className="absolute -right-1.5 -top-1.5 h-4 min-w-4 rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {unreadMessages > 99 ? "99+" : unreadMessages}
                </Badge>
              ) : null}
            </Link>
          </Button>
          <NotificationBell />
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
        </div>
      </div>

      {showSearch ? (
        <form onSubmit={handleSearch} className="border-t border-border/70 px-4 py-2 lg:hidden">
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
      ) : null}
    </header>
  );
}
