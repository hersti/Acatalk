import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-extrabold mb-6">Kullanım Şartları</h1>

        <div className="space-y-6">
          <Card className="border-0" style={{ boxShadow: 'var(--shadow-warm)' }}>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-4">
              <h2 className="text-base font-bold text-foreground">1. Genel Koşullar</h2>
              <p>
                ACATALK platformunu kullanarak aşağıdaki şartları kabul etmiş sayılırsınız.
                Platform, üniversite öğrencilerinin akademik bilgi paylaşımı amacıyla hizmet vermektedir.
              </p>

              <h2 className="text-base font-bold text-foreground">2. Kullanıcı Sorumlulukları</h2>
              <p>
                Kullanıcılar, paylaştıkları içeriklerden sorumludur. Telif hakkı ihlali,
                uygunsuz içerik, spam ve kötüye kullanım kesinlikle yasaktır.
              </p>

              <h2 className="text-base font-bold text-foreground">3. İçerik Politikası</h2>
              <p>
                Paylaşılan tüm içerikler platformun moderasyon kurallarına tabidir.
                Uygunsuz içerikler yöneticiler tarafından kaldırılabilir ve kullanıcı hesabı askıya alınabilir.
              </p>

              <h2 className="text-base font-bold text-foreground">4. Fikri Mülkiyet</h2>
              <p>
                Kullanıcılar, paylaştıkları içeriklerin fikri mülkiyet haklarına sahip olduklarını
                veya paylaşım yetkisine sahip olduklarını beyan eder. Telif hakkı ihlali durumunda
                içerik kaldırılır ve gerekli yasal işlemler başlatılabilir.
              </p>

              <h2 className="text-base font-bold text-foreground">5. Gizlilik</h2>
              <p>
                Kullanıcı verileri güvenli bir şekilde saklanır ve üçüncü taraflarla paylaşılmaz.
                Kişisel bilgiler yalnızca platform hizmetlerinin sunulması amacıyla kullanılır.
              </p>

              <h2 className="text-base font-bold text-foreground">6. Hesap Güvenliği</h2>
              <p>
                Kullanıcılar hesap güvenliğinden sorumludur. Şüpheli aktivite durumunda
                platform yönetimi hesabı geçici olarak askıya alabilir.
              </p>

              <h2 className="text-base font-bold text-foreground">7. Değişiklikler</h2>
              <p>
                ACATALK, bu kullanım şartlarını önceden bildirimde bulunmaksızın değiştirme hakkını saklı tutar.
                Güncel şartlar her zaman bu sayfadan erişilebilir olacaktır.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
