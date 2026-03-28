import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, GraduationCap, LogOut, User, Trophy, Shield, MessageCircle, Globe, Settings, School } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import NotificationBell from "@/components/NotificationBell";
import { NavLink } from "@/components/NavLink";
import ThemeToggle from "@/components/ThemeToggle";

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const isOnHomePage = location.pathname === "/";

  // Only auto-search (debounce) when already on the home page
  useEffect(() => {
    if (!isOnHomePage) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchQuery.trim()) {
        navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`, { replace: true });
      } else if (location.search.includes("search")) {
        navigate("/", { replace: true });
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, isOnHomePage]);

  // When navigating to home page, sync navbar search with URL
  useEffect(() => {
    if (isOnHomePage) {
      const params = new URLSearchParams(location.search);
      const urlSearch = params.get("search") || "";
      if (urlSearch !== searchQuery) {
        setSearchQuery(urlSearch);
      }
    }
  }, [location.search, isOnHomePage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-bold text-foreground hidden sm:inline tracking-tight">
            ACATALK
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1 ml-4">
          <NavLink to="/community" className="px-3 py-1.5 text-sm font-medium text-muted-foreground rounded-md hover:bg-muted hover:text-foreground transition-colors" activeClassName="bg-muted text-foreground">Topluluk Sohbeti</NavLink>
          <NavLink to="/university-chat" className="px-3 py-1.5 text-sm font-medium text-muted-foreground rounded-md hover:bg-muted hover:text-foreground transition-colors" activeClassName="bg-muted text-foreground">Üni Sohbet</NavLink>
        </nav>

        <form onSubmit={handleSearch} className="flex-1 max-w-sm mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm rounded-lg bg-muted border-transparent focus:border-border focus:bg-background"
            />
          </div>
        </form>

        <div className="flex items-center gap-0 shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigate("/leaderboard")} aria-label="Sıralama"><Trophy className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg lg:hidden" onClick={() => navigate("/community")} aria-label="Topluluk Sohbeti"><Globe className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg lg:hidden" onClick={() => navigate("/university-chat")} aria-label="Üniversite Sohbet"><School className="h-4 w-4" /></Button>

          <ThemeToggle />

          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigate("/admin")} aria-label="Yönetici Paneli">
              <Shield className="h-4 w-4" />
            </Button>
          )}

          {user ? (
            <>
              <NotificationBell />
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigate("/messages")} aria-label="Mesajlar"><MessageCircle className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigate("/profile")} aria-label="Profil"><User className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={() => navigate("/settings")} aria-label="Ayarlar"><Settings className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive" onClick={signOut} aria-label="Çıkış yap"><LogOut className="h-4 w-4" /></Button>
            </>
          ) : (
            <Button onClick={() => navigate("/auth")} size="sm" className="h-9 rounded-lg text-sm font-semibold px-4 ml-1">
              Giriş Yap
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
