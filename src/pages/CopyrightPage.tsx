import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Copyright, AlertTriangle, FileText, Scale } from "lucide-react";

export default function CopyrightPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-extrabold mb-6">Telif Hakkı ve Fikri Mülkiyet</h1>

        <div className="space-y-6">
          <Card className="border-0" style={{ boxShadow: 'var(--shadow-warm)' }}>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-5">
              <div className="flex items-start gap-3">
                <Copyright className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Genel İlke</h2>
                  <p>
                    ACATALK, kullanıcıların akademik bilgi paylaşımını kolaylaştırmak amacıyla hizmet vermektedir.
                    Platform üzerinde paylaşılan tüm içeriklerin fikri mülkiyet haklarına saygı gösterilmesi zorunludur.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Kullanıcı Sorumlulukları</h2>
                  <ul className="list-disc list-inside space-y-1.5">
                    <li>Kullanıcılar, paylaştıkları içeriklerin telif haklarına sahip olduklarını veya paylaşım yetkisine sahip olduklarını beyan eder.</li>
                    <li>Başkalarına ait ders materyallerini, kitapları veya kaynaklarını izinsiz paylaşmak yasaktır.</li>
                    <li>Kendi hazırladığınız notlar, özetler ve tartışma içerikleri serbestçe paylaşılabilir.</li>
                    <li>Öğretim üyelerinin izni olmadan ders materyallerinin paylaşılması sorumluluk doğurabilir.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">İhlal Bildirimi</h2>
                  <p>Telif hakkı ihlali tespit ettiğinizde aşağıdaki adımları izleyebilirsiniz:</p>
                  <ol className="list-decimal list-inside mt-2 space-y-1.5">
                    <li>İlgili içeriği platform üzerinden "Bildir" butonu ile raporlayın.</li>
                    <li>Rapor sebebi olarak "Telif hakkı ihlali" seçeneğini belirtin.</li>
                    <li>Detay kısmında hak sahibi olduğunuzu ve ihlal edilen içeriği açıklayın.</li>
                    <li>Moderasyon ekibimiz en kısa sürede inceleme yapacaktır.</li>
                  </ol>
                  <p className="mt-2">
                    Ayrıca <strong>destek@acatalk.com</strong> adresine doğrudan başvurabilirsiniz.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Scale className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Yaptırımlar</h2>
                  <ul className="list-disc list-inside space-y-1.5">
                    <li>Telif hakkı ihlali içeren içerikler derhal kaldırılır.</li>
                    <li>Tekrarlayan ihlallerde kullanıcı hesabı askıya alınabilir.</li>
                    <li>Ağır ihlallerde hesap kalıcı olarak kapatılabilir.</li>
                    <li>Gerekli hallerde yasal süreç başlatılabilir.</li>
                  </ul>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  © {new Date().getFullYear()} ACATALK. Platform adı ve logosu ACATALK'a aittir.
                  Kullanıcı içerikleri, paylaşan kullanıcıların sorumluluğundadır.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
