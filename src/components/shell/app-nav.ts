import {
  Bell,
  BookOpen,
  Building2,
  Home,
  MessageCircle,
  Settings,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavBadgeKey = "messages" | "notifications";

export type AppNavItem = {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: NavBadgeKey;
};

export const APP_PRIMARY_ITEMS: AppNavItem[] = [
  { key: "feed", to: "/", label: "Ana Akis", icon: Home, exact: true },
  { key: "courses", to: "/courses", label: "Dersler", icon: BookOpen },
  { key: "universities", to: "/universities", label: "Universiteler", icon: Building2 },
  { key: "communities", to: "/communities", label: "Topluluklar", icon: Users },
  { key: "leaderboard", to: "/leaderboard", label: "Liderlik", icon: Trophy },
];

export const APP_INBOX_ITEMS: AppNavItem[] = [
  { key: "messages", to: "/messages", label: "Mesajlar", icon: MessageCircle, badgeKey: "messages" },
  { key: "notifications", to: "/notifications", label: "Bildirimler", icon: Bell, badgeKey: "notifications" },
];

export const APP_MOBILE_ITEMS: AppNavItem[] = [
  { key: "feed", to: "/", label: "Akis", icon: Home, exact: true },
  { key: "courses", to: "/courses", label: "Dersler", icon: BookOpen },
  { key: "messages", to: "/messages", label: "Mesajlar", icon: MessageCircle, badgeKey: "messages" },
  { key: "notifications", to: "/notifications", label: "Bildirim", icon: Bell, badgeKey: "notifications" },
  { key: "profile", to: "/profile", label: "Profil", icon: User },
];

export const APP_SETTINGS_ITEMS: AppNavItem[] = [
  { key: "settings", to: "/settings", label: "Ayarlar", icon: Settings },
];

type TitleRule = {
  match: (pathname: string) => boolean;
  title: string;
  description: string;
};

const TITLE_RULES: TitleRule[] = [
  { match: (pathname) => pathname === "/", title: "Ana Akis", description: "Kesif ve akademik sosyal akisin merkezi" },
  { match: (pathname) => pathname.startsWith("/courses"), title: "Dersler", description: "Ders hublari, kaynaklar ve tartismalar" },
  { match: (pathname) => pathname.startsWith("/course/"), title: "Course Hub", description: "Ders baglaminda icerik ve sohbet" },
  { match: (pathname) => pathname.startsWith("/universities"), title: "Universiteler", description: "Universite bazli topluluk ve sinyaller" },
  { match: (pathname) => pathname.startsWith("/messages"), title: "Mesajlar", description: "Hizli ileti sim ve DM akisi" },
  { match: (pathname) => pathname.startsWith("/notifications"), title: "Bildirimler", description: "Aksiyon gerektiren olaylar" },
  { match: (pathname) => pathname.startsWith("/communities"), title: "Topluluklar", description: "Ilgi alanina gore topluluk kesfi" },
  { match: (pathname) => pathname.startsWith("/leaderboard"), title: "Liderlik", description: "Katki ve guven sinyalleri" },
  { match: (pathname) => pathname.startsWith("/profile"), title: "Profil", description: "Katki gecmisi ve hesap bilgileri" },
  { match: (pathname) => pathname.startsWith("/settings"), title: "Ayarlar", description: "Hesap, guvenlik ve tercih yonetimi" },
  { match: (pathname) => pathname.startsWith("/admin"), title: "Admin", description: "Moderasyon ve yonetim is akislari" },
];

export function getShellTitle(pathname: string) {
  const matched = TITLE_RULES.find((rule) => rule.match(pathname));
  if (matched) {
    return { title: matched.title, description: matched.description };
  }

  return {
    title: "AcaTalk",
    description: "Akademik sosyal platform",
  };
}
