import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare } from "lucide-react";

export default function ContactPage() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-extrabold mb-6">İletişim</h1>

        <div className="space-y-6">
          <Card className="border-0" style={{ boxShadow: 'var(--shadow-warm)' }}>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" /> Bize Ulaşın
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>
                Sorularınız, önerileriniz veya geri bildirimleriniz için bize ulaşabilirsiniz.
              </p>
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <p className="font-medium text-foreground">E-posta</p>
                <p>destek@acatalk.com</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ boxShadow: 'var(--shadow-warm)' }}>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Geri Bildirim
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <p>
                Platform hakkında geri bildirimlerinizi topluluk sohbetinde paylaşabilir
                veya doğrudan yöneticilere mesaj gönderebilirsiniz.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
