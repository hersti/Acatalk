# AcaTalk — Deployment ve Senkron Düzeni

## Amaç
Bu dosya, projenin deploy ve senkron akışını tanımlar. Amaç frontend, backend ve edge function tarafında dağınıklığı azaltmak ve tek bir çalışma düzeni oluşturmaktır.

## Kullanılan Servisler
- GitHub → ana kod deposu
- Vercel → frontend deployment
- Supabase → veritabanı, auth, storage, edge functions
- Claude / ChatGPT → analiz, refactor, hata çözme, planlama

## Ana Kural
Mümkün olduğunca kodun ana kaynağı GitHub olmalıdır.

Aşağıdaki yapı hedeflenir:
- Frontend kodu repoda tutulur
- Supabase edge function kodları da repoda tutulur
- Vercel deploy’u repo üzerinden yapılır
- Supabase edge function deploy’u repo içindeki güncel kod baz alınarak yapılır

## Frontend Deploy Akışı
Beklenen akış:
1. Frontend kodunda değişiklik yapılır
2. Değişiklik commit edilir
3. GitHub’a push edilir
4. Vercel otomatik build/deploy tetikler
5. Deploy sonucu kontrol edilir

## Frontend İçin Kontrol Noktaları
- Vercel doğru GitHub repo’suna bağlı mı?
- Doğru branch production deploy’a bağlı mı?
- Environment variables eksiksiz mi?
- Build hatası var mı?
- SPA routing doğru çalışıyor mu?
- Preview ve production ortamları tutarlı mı?

## Supabase Edge Function Deploy Akışı
Beklenen akış:
1. Function kodu repoda güncellenir
2. Gerekirse ilgili env/secrets kontrol edilir
3. Supabase tarafına deploy yapılır
4. Deploy sonrası function test edilir
5. Gerekirse log kontrol edilir
6. Değişiklik PROJECT_CONTEXT.md ve KNOWN_ISSUES.md dosyalarına yansıtılır

## Edge Function İçin Kontrol Noktaları
- Fonksiyon adı doğru mu?
- Versiyon bilgisi not edildi mi?
- verify_jwt ayarı beklendiği gibi mi?
- Gerekli secrets tanımlı mı?
- Frontend doğru endpoint’i çağırıyor mu?
- Dönüş formatı frontend beklentisiyle uyumlu mu?

## Environment Variables / Secrets Düzeni

### Vercel
Frontend tarafında kullanılan değişkenler burada tutulur.
Örnek:
- VITE_SUPABASE_PROJECT_ID
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

### Supabase
Edge function secrets burada tutulur.
Örnek:
- ANTHROPIC_API_KEY
- TURNSTILE_SITE_KEY
- TURNSTILE_SECRET_KEY
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## Değişiklik Sonrası Kontrol Sırası

### Frontend değiştiyse
1. Kod doğru dosyada mı?
2. Type/build hatası var mı?
3. Commit/push yapıldı mı?
4. Vercel deploy tetiklendi mi?
5. İlgili sayfa/özellik production’da çalışıyor mu?

### Edge function değiştiyse
1. Repo içindeki function güncel mi?
2. Gerekli secret var mı?
3. Supabase deploy yapıldı mı?
4. Loglar temiz mi?
5. Frontend entegrasyonu çalışıyor mu?

### Veritabanı değiştiyse
1. Migration yazıldı mı?
2. Uygulandı mı?
3. RLS/policy etkisi kontrol edildi mi?
4. Frontend tarafındaki sorgular etkileniyor mu?

## Rollback Mantığı
Bir deploy sorun çıkarırsa şu sırayla ilerlenir:
1. Sorunun frontend mi backend mi olduğunu ayır
2. Son çalışan commit / son çalışan function sürümünü belirle
3. Environment farkı olup olmadığını kontrol et
4. Son değişiklikleri geri al veya önceki çalışan sürüme dön
5. KNOWN_ISSUES.md içine sorunu not et

## Senkron Problemi Varsa
Aşağıdaki ihtimaller kontrol edilir:
- Repo güncel değil
- Lokal kod ile repo farklı
- Vercel yanlış branch’ten deploy alıyor
- Supabase’de deploy edilen function ile repo içindeki function farklı
- Environment variables eksik veya yanlış
- Frontend eski endpoint/model/config kullanıyor

## Hedeflenen Düzen
Uzun vadede hedef:
- GitHub = ana kaynak
- Vercel = frontend dağıtım katmanı
- Supabase = backend çalıştırma katmanı
- Bağlam dosyaları = süreklilik katmanı

## Her Büyük Değişiklikten Sonra Güncellenecek Dosyalar
- PROJECT_CONTEXT.md
- DEPLOYMENT.md
- KNOWN_ISSUES.md

## Not
Bu dosyadaki akışlar varsayım değil, hedef çalışma düzenidir. Gerçek durum farklıysa önce mevcut durum doğrulanmalı, sonra bu düzene yaklaştırılmalıdır.