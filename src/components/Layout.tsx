import { ReactNode } from "react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import SupportButton from "./SupportButton";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalPresence } from "@/hooks/useGlobalPresence";

export default function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  useGlobalPresence(user?.id);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
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
