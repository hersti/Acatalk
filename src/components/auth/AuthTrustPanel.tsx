import { BookOpen, Building2, ShieldCheck, Users } from "lucide-react";

import { AcademicMeta } from "@/components/ui/academic-meta";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

type AuthTrustPanelMode = "auth" | "recovery";

type AuthTrustPanelProps = {
  mode?: AuthTrustPanelMode;
  className?: string;
};

const COPY: Record<
  AuthTrustPanelMode,
  { badge: string; title: string; description: string; points: string[] }
> = {
  auth: {
    badge: "Doğrulanmış Öğrenci Ağı",
    title: "Güvenilir akademik giriş deneyimi",
    description:
      "Üniversite e-posta doğrulaması, bölüm bağlamı ve topluluk kalite standartları birlikte çalışır.",
    points: [
      "Üniversite e-posta alan adı doğrulaması",
      "Bölüm ve program bağlamıyla profil",
      "Topluluk içeriklerinde güven odaklı akış",
    ],
  },
  recovery: {
    badge: "Güvenli Hesap Kurtarma",
    title: "Hesabını güvenli şekilde geri al",
    description:
      "Şifrenizi sıfırlarken aynı akademik kimlik ve güven standartları korunur.",
    points: [
      "Güvenli sıfırlama bağlantısı",
      "Şifre güvenliği kontrolü",
      "Oturum güvenlik politikası",
    ],
  },
};

export default function AuthTrustPanel({ mode = "auth", className }: AuthTrustPanelProps) {
  const content = COPY[mode];

  return (
    <Surface
      variant="soft"
      border="subtle"
      padding="lg"
      radius="xl"
      className={cn("h-full", className)}
    >
      <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        {content.badge}
      </p>

      <h2 className="mt-3 font-heading text-2xl font-extrabold tracking-tight text-foreground">
        {content.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{content.description}</p>

      <AcademicMeta
        className="mt-4"
        size="sm"
        tone="muted"
        items={[
          { kind: "verified", label: "Doğrulanmış", value: "Üniversite Öğrencisi", emphasis: "subtle" },
          { kind: "custom", label: "Odak", value: "Akademik İçerik", emphasis: "subtle" },
        ]}
      />

      <div className="mt-6 space-y-3">
        {content.points.map((point, index) => (
          <div key={point} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
              {index === 0 ? (
                <Building2 className="h-3.5 w-3.5 text-primary" />
              ) : index === 1 ? (
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Users className="h-3.5 w-3.5 text-primary" />
              )}
            </div>
            <p className="text-sm text-foreground/90">{point}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}
