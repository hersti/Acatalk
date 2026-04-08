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
  { key: "feed", to: "/", label: "Ana Sayfa", icon: Home, exact: true },
  { key: "courses", to: "/courses", label: "Dersler", icon: BookOpen },
  { key: "universities", to: "/universities", label: "Üniversiteler", icon: Building2 },
  { key: "communities", to: "/communities", label: "Topluluklar", icon: Users },
  { key: "leaderboard", to: "/leaderboard", label: "Lider Tablosu", icon: Trophy },
];

export const APP_INBOX_ITEMS: AppNavItem[] = [
  { key: "messages", to: "/messages", label: "Mesajlar", icon: MessageCircle, badgeKey: "messages" },
  { key: "notifications", to: "/notifications", label: "Bildirimler", icon: Bell, badgeKey: "notifications" },
];

export const APP_MOBILE_ITEMS: AppNavItem[] = [
  { key: "feed", to: "/", label: "Ana Sayfa", icon: Home, exact: true },
  { key: "courses", to: "/courses", label: "Dersler", icon: BookOpen },
  { key: "messages", to: "/messages", label: "Mesajlar", icon: MessageCircle, badgeKey: "messages" },
  { key: "notifications", to: "/notifications", label: "Bildirim", icon: Bell, badgeKey: "notifications" },
  { key: "profile", to: "/profile", label: "Profil", icon: User },
];

export const APP_SETTINGS_ITEMS: AppNavItem[] = [
  { key: "profile", to: "/profile", label: "Profil", icon: User },
  { key: "settings", to: "/settings", label: "Ayarlar", icon: Settings },
];

type TitleRule = {
  match: (pathname: string) => boolean;
  title: string;
  description: string;
};

const TITLE_RULES: TitleRule[] = [
  { match: (pathname) => pathname === "/", title: "Ana Sayfa", description: "Akademik fayda odaklı ana akış" },
  { match: (pathname) => pathname.startsWith("/courses"), title: "Dersler", description: "Ders hub'ları, kaynaklar ve tartışmalar" },
  { match: (pathname) => pathname.startsWith("/course/"), title: "Course Hub", description: "Ders bağlamında içerik ve sohbet" },
  { match: (pathname) => pathname.startsWith("/universities"), title: "Üniversiteler", description: "Üniversite bazlı topluluk ve sinyaller" },
  { match: (pathname) => pathname.startsWith("/messages"), title: "Mesajlar", description: "Hızlı iletişim ve DM akışı" },
  { match: (pathname) => pathname.startsWith("/notifications"), title: "Bildirimler", description: "Aksiyon gerektiren olaylar" },
  { match: (pathname) => pathname.startsWith("/communities"), title: "Topluluklar", description: "İlgi alanına göre topluluk keşfi" },
  { match: (pathname) => pathname.startsWith("/leaderboard"), title: "Lider Tablosu", description: "Katkı ve güven sinyalleri" },
  { match: (pathname) => pathname.startsWith("/profile"), title: "Profil", description: "Katkı geçmişi ve hesap bilgileri" },
  { match: (pathname) => pathname.startsWith("/user/"), title: "Profil", description: "Akademik kimlik ve katkı görünümü" },
  { match: (pathname) => pathname.startsWith("/settings"), title: "Ayarlar", description: "Hesap, güvenlik ve tercih yönetimi" },
  { match: (pathname) => pathname.startsWith("/admin"), title: "Admin", description: "Moderasyon ve yönetim iş akışları" },
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
