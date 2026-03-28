import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, Ban, Heart } from "lucide-react";

export default function CommunityRulesPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-extrabold mb-6">Topluluk Kuralları</h1>

        <div className="space-y-6">
          <Card className="border-0" style={{ boxShadow: 'var(--shadow-warm)' }}>
            <CardContent className="pt-6 text-sm text-muted-foreground leading-relaxed space-y-5">
              <div className="flex items-start gap-3">
                <Heart className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Saygılı Olun</h2>
                  <p>Diğer kullanıcılara her zaman saygılı ve nazik davranın. Hakaret, küfür, taciz ve nefret söylemi kesinlikle yasaktır.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Güvenli İçerik Paylaşın</h2>
                  <p>Uygunsuz, müstehcen (NSFW), şiddet içeren veya yasadışı içerik paylaşmak yasaktır. Bu tür içerikler otomatik olarak tespit edilir ve kaldırılır.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Spam Yapmayın</h2>
                  <p>Aynı içeriği tekrar tekrar paylaşmak, reklam yapmak veya sahte hesaplar oluşturmak yasaktır.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-foreground mb-1">Telif Haklarına Uyun</h2>
                  <p>Başkalarına ait içerikleri izinsiz paylaşmayın. Telif hakkı ihlalleri yasal sorumluluk doğurabilir.</p>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h2 className="text-base font-bold text-foreground mb-2">Yaptırımlar</h2>
                <ul className="list-disc list-inside space-y-1.5">
                  <li><strong>Uyarı:</strong> İlk ihlallerde kullanıcıya uyarı verilir.</li>
                  <li><strong>Geçici susturma:</strong> Tekrarlayan ihlallerde sohbet özelliği geçici olarak engellenir.</li>
                  <li><strong>Hesap askıya alma:</strong> Ciddi ihlallerde hesap geçici veya kalıcı olarak askıya alınır.</li>
                  <li><strong>Hesap silme:</strong> Ağır ihlallerde hesap kalıcı olarak silinebilir.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
