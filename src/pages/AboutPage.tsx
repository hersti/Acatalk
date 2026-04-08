import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Users, BookOpen, Shield } from "lucide-react";

export default function AboutPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-extrabold mb-6">Hakkımızda</h1>

        <div className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> ACATALK Nedir?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                ACATALK, Türkiye'deki üniversite öğrencileri için geliştirilmiş akademik bilgi paylaşım platformudur.
                Öğrenciler ders notlarını, geçmiş sınavları, kaynakları ve tartışmaları paylaşarak birbirlerine yardımcı olabilirler.
              </p>
              <p>
                Platformumuz, üniversite hayatını kolaylaştırmayı ve öğrenciler arasında güçlü bir akademik topluluk oluşturmayı hedeflemektedir.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Misyonumuz
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <p>
                Akademik bilgiye erişimi demokratikleştirmek, öğrencilerin birbirleriyle bağlantı kurmasını sağlamak
                ve her üniversite öğrencisinin başarıya ulaşması için gerekli kaynaklara ulaşabilmesini temin etmek.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Özellikler
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <ul className="list-disc list-inside space-y-1.5">
                <li>Ders notları ve geçmiş sınav paylaşımı</li>
                <li>Ders bazlı tartışma alanları</li>
                <li>Topluluk ve üniversite sohbetleri</li>
                <li>Kullanıcı profilleri ve rozet sistemi</li>
                <li>Doğrudan mesajlaşma</li>
                <li>Güvenli içerik moderasyonu</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" /> Güvenlik
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <p>
                ACATALK, kullanıcı güvenliğini en üst düzeyde tutmayı taahhüt eder. Yapay zeka destekli içerik moderasyonu,
                kullanıcı raporlama sistemi ve yönetici denetimi ile güvenli bir ortam sağlanmaktadır.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
