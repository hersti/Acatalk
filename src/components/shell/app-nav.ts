import {
  Bell,
  BookOpen,
  Building2,
  Home,
  MessageCircle,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const APP_PRIMARY_ITEMS: AppNavItem[] = [
  { to: "/", label: "Ana Akış", icon: Home, exact: true },
  { to: "/notifications", label: "Bildirimler", icon: Bell },
  { to: "/messages", label: "Mesajlar", icon: MessageCircle },
  { to: "/communities", label: "Topluluklar", icon: Users },
  { to: "/universities", label: "Üniversiteler", icon: Building2 },
  { to: "/courses", label: "Dersler", icon: BookOpen },
  { to: "/leaderboard", label: "Sıralama", icon: Trophy },
];
