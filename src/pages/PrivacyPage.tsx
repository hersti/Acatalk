import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Lock, Eye } from "lucide-react";

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-extrabold mb-6">Gizlilik Politikası</h1>

        <div className="space-y-6">
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-5">
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Toplanan Veriler</h2>
                  <p>ACATALK, hizmetlerini sunmak için aşağıdaki verileri toplar ve saklar:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Hesap bilgileri (e-posta, kullanıcı adı)</li>
                    <li>Profil bilgileri (üniversite, bölüm, sınıf, biyografi)</li>
                    <li>Paylaşılan içerikler (gönderiler, yorumlar, mesajlar)</li>
                    <li>Yüklenen dosyalar ve avatar görselleri</li>
                    <li>Oturum bilgileri ve güvenlik logları</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Verilerin Kullanımı</h2>
                  <p>Toplanan veriler yalnızca aşağıdaki amaçlarla kullanılır:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Platform hizmetlerinin sunulması ve iyileştirilmesi</li>
                    <li>Kullanıcı deneyiminin kişiselleştirilmesi</li>
                    <li>İçerik moderasyonu ve platform güvenliği</li>
                    <li>İstatistiksel analiz ve raporlama</li>
                  </ul>
                  <p className="mt-2">Verileriniz üçüncü taraflarla paylaşılmaz ve ticari amaçla kullanılmaz.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Veri Güvenliği</h2>
                  <p>Kullanıcı verilerinin güvenliği için aşağıdaki önlemler alınmıştır:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Şifreleme ile korunan veri transferi (HTTPS/TLS)</li>
                    <li>Güvenli veritabanı erişim kontrolleri (RLS)</li>
                    <li>Düzenli güvenlik denetimleri ve güncellemeler</li>
                    <li>Brute-force koruması ve şüpheli giriş tespiti</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Kullanıcı Hakları</h2>
                  <p>Kullanıcılar aşağıdaki haklara sahiptir:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Kişisel verilerine erişim ve düzeltme hakkı</li>
                    <li>Hesap silme ve veri temizleme talebi</li>
                    <li>Veri taşınabilirliği hakkı</li>
                    <li>İşleme itiraz hakkı</li>
                  </ul>
                  <p className="mt-2">Bu haklarınızı kullanmak için <strong>destek@acatalk.com</strong> adresine başvurabilirsiniz.</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  Son güncelleme: Mart 2026. ACATALK, bu politikayı önceden bildirimde bulunarak güncelleme hakkını saklı tutar.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
