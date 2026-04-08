import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { GraduationCap } from "lucide-react";

import SupportButton from "@/components/SupportButton";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalPresence } from "@/hooks/useGlobalPresence";
import AppSidebar from "@/components/shell/AppSidebar";
import AppTopbar from "@/components/shell/AppTopbar";
import MobileBottomNav from "@/components/shell/MobileBottomNav";
import PublicTopbar from "@/components/shell/PublicTopbar";
import { useInboxCounters } from "@/features/inbox/hooks/use-inbox-counters";

const AUTH_SHELL_MATCHERS: Array<(pathname: string) => boolean> = [
  (pathname) => pathname === "/",
  (pathname) => pathname === "/courses",
  (pathname) => pathname.startsWith("/course/"),
  (pathname) => pathname.startsWith("/post/"),
  (pathname) => pathname === "/universities",
  (pathname) => pathname.startsWith("/universities/"),
  (pathname) => pathname === "/messages",
  (pathname) => pathname === "/notifications",
  (pathname) => pathname === "/communities",
  (pathname) => pathname.startsWith("/communities/"),
  (pathname) => pathname === "/community",
  (pathname) => pathname === "/profile",
  (pathname) => pathname.startsWith("/user/"),
  (pathname) => pathname === "/leaderboard",
  (pathname) => pathname === "/settings",
  (pathname) => pathname === "/admin",
  (pathname) => pathname === "/university-chat",
];

function shouldUseAuthenticatedShell(pathname: string) {
  return AUTH_SHELL_MATCHERS.some((matcher) => matcher(pathname));
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  useGlobalPresence(user?.id);

  const isAuthenticatedAppShell = !!user && shouldUseAuthenticatedShell(location.pathname);
  const { unreadMessages, unreadNotifications, refresh } = useInboxCounters(user?.id);

  useEffect(() => {
    if (!user) return;

    if (location.pathname.startsWith("/messages") || location.pathname.startsWith("/notifications")) {
      void refresh();
    }
  }, [location.pathname, refresh, user]);

  if (isAuthenticatedAppShell) {
    return (
      <div className="app-shell-main">
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">
          <AppSidebar unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
        </div>

        <div className="flex min-h-screen flex-col lg:pl-[var(--shell-left-width)]">
          <AppTopbar unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
          <main className="flex-1 bg-[hsl(var(--background))] pb-[5.6rem] lg:pb-0">{children}</main>
        </div>

        <MobileBottomNav unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />
        <SupportButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PublicTopbar />
      <main className="flex-1">{children}</main>
      <SupportButton />
      <footer className="mt-12 border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span className="font-heading text-base font-bold tracking-tight">ACATALK</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Turkiye ve KKTC universite ogrencileri icin akademik sosyal ag.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">Platform</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Hakkimizda
                </Link>
                <Link to="/community-rules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Topluluk Kurallari
                </Link>
                <Link to="/leaderboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Siralama
                </Link>
              </nav>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">Kesif</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/universities" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Universiteler
                </Link>
                <Link to="/courses" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Dersler
                </Link>
                <Link to="/communities" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Topluluklar
                </Link>
              </nav>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">Yasal</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Kullanim Sartlari
                </Link>
                <Link to="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Gizlilik Politikasi
                </Link>
                <Link to="/copyright" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Telif Hakki
                </Link>
              </nav>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ACATALK. Tum haklari saklidir.</p>
            <p className="text-xs text-muted-foreground">Akademik baglamli sosyal ogrenme platformu</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
