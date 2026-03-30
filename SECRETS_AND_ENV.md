# AcaTalk — Secrets & Environment Variables

## Amaç
Bu dosya projede kullanılan environment variable ve secret yapılarını takip etmek için tutulur.
Gerçek secret değerleri burada tutulmaz.
Burada sadece değişken adı, nerede saklandığı, ne işe yaradığı ve zorunluluk durumu yazılır.

---

## 1) Supabase Edge Function Secrets

Supabase Dashboard → Settings → Edge Functions → Secrets

| Secret Name | Nerede Kullanılır | Açıklama | Zorunlu mu |
|---|---|---|---|
| SUPABASE_URL | Edge Functions | Supabase proje URL'i | Evet |
| SUPABASE_ANON_KEY | Edge Functions | Publishable / anon key | Evet |
| SUPABASE_SERVICE_ROLE_KEY | Edge Functions | Admin erişim anahtarı | Evet |
| SUPABASE_DB_URL | Edge Functions / DB işlemleri | Veritabanı bağlantı URL'i | Duruma bağlı |
| TURNSTILE_SITE_KEY | Edge Functions | Cloudflare Turnstile site key | Turnstile kullanılıyorsa evet |
| TURNSTILE_SECRET_KEY | Edge Functions | Cloudflare Turnstile secret key | Turnstile kullanılıyorsa evet |

---

## 2) AI Provider Secret'ları

Bu bölümde yalnızca aktif kullanılan AI sağlayıcısı tutulmalıdır.

| Secret Name | Nerede Kullanılır | Açıklama | Zorunlu mu |
|---|---|---|---|
| ANTHROPIC_API_KEY | AI edge functions | Claude / Anthropic çağrıları için | Eğer Anthropic kullanılıyorsa evet |
| OPENAI_API_KEY | AI edge functions | OpenAI çağrıları için | Eğer OpenAI kullanılıyorsa evet |
| GEMINI_API_KEY | AI edge functions | Gemini çağrıları için | Eğer Gemini kullanılıyorsa evet |

## Not
- Aynı anda birden fazla provider desteklenmiyorsa aktif olmayan provider secret'larını gerekli gibi göstermeyin.
- Lovable gateway kaldırıldıysa `LOVABLE_API_KEY` aktif secret listesinde tutulmamalıdır.
- Geçiş tamamlandıysa eski AI gateway bilgileri kaldırılmalıdır.

---

## 3) Frontend Environment Variables (.env / Vercel Environment Variables)

| Variable | Nerede Kullanılır | Açıklama | Zorunlu mu |
|---|---|---|---|
| VITE_SUPABASE_PROJECT_ID | Frontend | Supabase proje ref ID'si | Evet |
| VITE_SUPABASE_URL | Frontend | Supabase proje URL'i | Evet |
| VITE_SUPABASE_PUBLISHABLE_KEY | Frontend | Supabase anon / publishable key | Evet |

---

## 4) Kullanım Kuralları

- Gerçek secret değerlerini bu dosyaya yazma.
- Sadece secret isimlerini ve görevlerini yaz.
- Kullanımdan kaldırılmış değişkenleri “deprecated” olarak işaretle veya dosyadan kaldır.
- Yeni provider ya da yeni servis eklenirse bu dosyayı güncelle.
- Frontend ve backend değişkenlerini karıştırma.

---

## 5) Deprecated / Eski Yapılar

### LOVABLE_API_KEY
Durum: Deprecated / kaldırılmalı

Açıklama:
- Eğer AI çağrıları artık Lovable gateway üzerinden gitmiyorsa bu secret aktif yapıdan çıkarılmalıdır.
- Sadece geçmiş referansı olarak not tutulacaksa “deprecated” olarak işaretlenmelidir.
- Aktif sistemde Anthropic, OpenAI veya Gemini’den hangisi kullanılıyorsa o net şekilde belirtilmelidir.

---

## 6) Auth Trigger Notu

Aşağıdaki trigger gerekiyorsa gerçek veritabanında varlığı doğrulanmalıdır:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();