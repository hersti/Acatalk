import {
  Bell,
  GraduationCap,
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
  { to: "/leaderboard", label: "Sıralama", icon: Trophy },
  { to: "/community", label: "Topluluk", icon: Users },
  { to: "/university-chat", label: "Üni Sohbet", icon: GraduationCap },
];
