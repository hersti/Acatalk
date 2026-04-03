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
  if (pathname.startsWith("/course/")) return true;
  if (pathname.startsWith("/post/")) return true;
  if (pathname === "/profile") return true;
  if (pathname.startsWith("/user/")) return true;
  if (pathname === "/leaderboard") return true;
  if (pathname === "/messages") return true;
  if (pathname === "/settings") return true;
  if (pathname === "/notifications") return true;
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
      <div className="min-h-screen bg-background">
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block">
          <AppSidebar />
        </div>

        <div className="flex min-h-screen flex-col lg:pl-72">
          <AppTopbar />
          <main className="flex-1">{children}</main>
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
      <footer className="border-t border-border bg-muted/30 mt-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span className="font-heading font-bold text-base tracking-tight">ACATALK</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Türkiye'deki üniversite öğrencileri için akademik bilgi paylaşım platformu.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Platform</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Hakkımızda</Link>
                <Link to="/community-rules" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Topluluk Kuralları</Link>
                <Link to="/leaderboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sıralama</Link>
              </nav>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Destek</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">İletişim</Link>
                <Link to="/community" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Topluluk Sohbeti</Link>
              </nav>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Yasal</h4>
              <nav className="flex flex-col gap-2">
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Kullanım Şartları</Link>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Gizlilik Politikası</Link>
                <Link to="/copyright" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Telif Hakkı</Link>
              </nav>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ACATALK. Tüm hakları saklıdır.</p>
            <p className="text-xs text-muted-foreground">Akademik bilgi paylaşım platformu</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
