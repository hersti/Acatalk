import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  Lock,
  MessageSquare,
  ShieldCheck,
  Users,
} from "lucide-react";

import Layout from "@/components/Layout";
import AuthTrustPanel from "@/components/auth/AuthTrustPanel";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

export default function GuestLandingPage() {
  return (
    <Layout>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,theme(colors.primary.DEFAULT/12),transparent_45%),radial-gradient(circle_at_top_right,theme(colors.primary.DEFAULT/8),transparent_35%)]" />

        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Surface variant="raised" border="subtle" padding="lg" radius="xl">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Modern Akademik Sosyal Platform
              </p>
              <h1 className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Universite hayatinda guvenilir akademik akis
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                AcaTalk ile universite, bolum ve ders baglaminda not, cikmis soru, kaynak ve tartisma iceriklerini tek yerde takip et.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button asChild size="lg" className="h-11 rounded-lg px-6">
                  <Link to="/auth" className="inline-flex items-center gap-2">
                    Hesabina Gir
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 rounded-lg px-6">
                  <Link to="/auth">Yeni Hesap Olustur</Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <LandingMicroStat icon={CheckCircle2} text="Dogrulanmis ogrenci hissi" />
                <LandingMicroStat icon={BookOpen} text="Ders odakli icerik aileleri" />
                <LandingMicroStat icon={Lock} text="Guvenli ve olgun urun dili" />
              </div>
            </Surface>

            <AuthTrustPanel mode="auth" />
          </section>

          <section id="features" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LandingStat icon={BookOpen} value="Ders Odakli" label="Yapilandirilmis icerik" />
            <LandingStat icon={Users} value="Topluluk" label="Ogrenci etkilesimi" />
            <LandingStat icon={GraduationCap} value="Akademik" label="Profesyonel urun deneyimi" />
            <LandingStat icon={CheckCircle2} value="Guvenilir" label="Dogrulanmis kullanici hissi" />
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-base font-bold">1. Universiteni dogrula</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Universite e-postan ile kayit ol, akademik kimligini netlestir.
              </p>
            </Surface>
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-base font-bold">2. Ders baglaminda kesfet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Not, sinav, kaynak ve tartisma iceriklerini bolum/program baglaminda filtrele.
              </p>
            </Surface>
            <Surface variant="base" border="subtle" padding="md" radius="xl">
              <h2 className="font-heading text-base font-bold">3. Topluluga katki sagla</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Faydali icerik paylas, guvenilir akademik toplulukta gorunurluk kazan.
              </p>
            </Surface>
          </section>

          <section className="mt-6">
            <Surface variant="soft" border="subtle" padding="lg" radius="xl">
              <h2 className="font-heading text-lg font-bold">Neden AcaTalk?</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <LandingFeature
                  icon={FileText}
                  title="Not ve Cikmis Soru Paylasimi"
                  description="Icerikler ders ve program baglamiyla duzenli sekilde sunulur."
                />
                <LandingFeature
                  icon={MessageSquare}
                  title="Akademik Tartisma Kalitesi"
                  description="Topluluk etkileşimi faydali ve akademik eksende ilerler."
                />
                <LandingFeature
                  icon={ShieldCheck}
                  title="Guven Mesaji ve Dogrulama"
                  description="Universite dogrulamasi urunun merkezinde yer alir."
                />
              </div>
            </Surface>
          </section>
        </div>
      </div>
    </Layout>
  );
}

function LandingMicroStat({
  icon: Icon,
  text,
}: {
  icon: typeof FileText;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="text-xs font-medium text-foreground/85">{text}</span>
    </div>
  );
}

function LandingFeature({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function LandingStat({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof FileText;
  value: string;
  label: string;
}) {
  return (
    <Surface variant="base" border="subtle" padding="md" radius="xl" className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
      </div>
    </Surface>
  );
}
