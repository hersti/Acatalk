import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import SupportButton from "./SupportButton";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalPresence } from "@/hooks/useGlobalPresence";
import AppSidebar from "@/components/shell/AppSidebar";
import AppTopbar from "@/components/shell/AppTopbar";
import PublicTopbar from "@/components/shell/PublicTopbar";

function shouldUseAuthenticatedShell(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/courses") return true;
  if (pathname === "/universities") return true;
  if (pathname.startsWith("/universities/")) return true;
  if (pathname.startsWith("/course/")) return true;
  if (pathname.startsWith("/post/")) return true;
  if (pathname === "/profile") return true;
  if (pathname.startsWith("/user/")) return true;
  if (pathname === "/leaderboard") return true;
  if (pathname === "/messages") return true;
  if (pathname === "/settings") return true;
  if (pathname === "/notifications") return true;
  if (pathname === "/communities") return true;
  if (pathname === "/community") return true;
  if (pathname === "/university-chat") return true;
  if (pathname === "/admin") return true;

  return false;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  useGlobalPresence(user?.id);
  const isAuthenticatedAppShell = !!user && shouldUseAuthenticatedShell(location.pathname);

  if (isAuthenticatedAppShell) {
    return (
      <div className="app-shell-main">
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">
          <AppSidebar />
        </div>

        <div className="flex min-h-screen flex-col lg:pl-64">
          <AppTopbar />
          <main className="flex-1 bg-[hsl(var(--background))]">{children}</main>
        </div>
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
                Türkiye ve KKTC üniversite öğrencileri için akademik sosyal ağ.
              </p>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">Platform</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Hakkımızda
                </Link>
                <Link to="/community-rules" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Topluluk Kuralları
                </Link>
                <Link to="/leaderboard" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Sıralama
                </Link>
              </nav>
            </div>

            <div>
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-foreground">Keşif</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/universities" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Üniversiteler
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
                  Kullanım Şartları
                </Link>
                <Link to="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Gizlilik Politikası
                </Link>
                <Link to="/copyright" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Telif Hakkı
                </Link>
              </nav>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-border pt-6 sm:flex-row">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ACATALK. Tüm hakları saklıdır.</p>
            <p className="text-xs text-muted-foreground">Akademik bağlamlı sosyal öğrenme platformu</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
