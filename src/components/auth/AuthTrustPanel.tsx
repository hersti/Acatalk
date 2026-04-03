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
    badge: "Verified Student Network",
    title: "Akademik ve guvenilir giris deneyimi",
    description:
      "Universite e-postasi dogrulamasi, bolum baglami ve topluluk kalite kurallari birlikte calisir.",
    points: [
      "Universite email domain dogrulamasi",
      "Bolum ve program baglamiyla profil",
      "Topluluk iceriklerinde guven odakli akıs",
    ],
  },
  recovery: {
    badge: "Secure Account Recovery",
    title: "Hesabini guvenli sekilde geri al",
    description:
      "Sifrenizi sifirlarken ayni akademik kimlik ve guven standartlari korunur.",
    points: [
      "Guvenli reset baglantisi",
      "Sifre guclugu kontrolu",
      "Supabase oturum guvenlik politikasi",
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
      <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
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
          { kind: "verified", label: "Dogrulanmis", value: "Universite Ogrencisi", emphasis: "subtle" },
          { kind: "custom", label: "Odak", value: "Akademik Icerik", emphasis: "subtle" },
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

