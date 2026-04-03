import { Link, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export default function PublicTopbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-hero">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-heading text-base font-bold tracking-tight">ACATALK</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button size="sm" className="h-9 rounded-lg px-4 text-sm font-semibold" onClick={() => navigate("/")}>
              Ana Akış
            </Button>
          ) : (
            <Button size="sm" className="h-9 rounded-lg px-4 text-sm font-semibold" onClick={() => navigate("/auth")}>
              Giriş Yap
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

