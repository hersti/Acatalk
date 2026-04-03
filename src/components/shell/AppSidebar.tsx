import { Link } from "react-router-dom";
import {
  Bell,
  GraduationCap,
  Home,
  MessageCircle,
  Settings,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

type SidebarItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const PRIMARY_ITEMS: SidebarItem[] = [
  { to: "/", label: "Ana Akış", icon: Home, exact: true },
  { to: "/notifications", label: "Bildirimler", icon: Bell },
  { to: "/messages", label: "Mesajlar", icon: MessageCircle },
  { to: "/leaderboard", label: "Sıralama", icon: Trophy },
  { to: "/community", label: "Topluluk", icon: Users },
  { to: "/university-chat", label: "Üni Sohbet", icon: GraduationCap },
];

const ACCOUNT_ITEMS: SidebarItem[] = [
  { to: "/profile", label: "Profil", icon: User },
  { to: "/settings", label: "Ayarlar", icon: Settings },
];

function SidebarLink({ item }: { item: SidebarItem }) {
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
  return (
    <aside className="h-screen w-72 border-r border-border bg-card">
      <div className="flex h-full flex-col p-4">
        <Link to="/" className="mb-5 flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-hero">
            <GraduationCap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-heading text-base font-bold tracking-tight">ACATALK</p>
            <p className="text-[11px] text-muted-foreground">Akademik Sosyal Ağ</p>
          </div>
        </Link>

        <nav className="space-y-1">
          {PRIMARY_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="my-4 h-px bg-border" />

        <nav className="space-y-1">
          {ACCOUNT_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="mt-auto">
          <Surface variant="soft" border="subtle" padding="sm" className="text-xs text-muted-foreground">
            Doğrulanmış üniversite topluluğunda güvenli ve faydalı paylaşım.
          </Surface>
        </div>
      </div>
    </aside>
  );
}

