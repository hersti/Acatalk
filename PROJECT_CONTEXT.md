# AcaTalk — Proje Bağlam Dosyası

## Proje Bilgileri
- **Proje:** AcaTalk — Türk üniversite öğrencileri sosyal platformu
- **Site:** https://acatalk.vercel.app
- **Stack:** React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel
- **GitHub:** https://github.com/hersti/Acatalk

## Servis ID'leri
- **Supabase Project ID:** lueodetbmvrcxeinxvxb
- **Supabase Region:** eu-central-1
- **Vercel Project ID:** prj_4nTJuf8ERtlUIygzxuJHuBczRvhk
- **Vercel Team ID:** team_uIEpd3aGxN9V1dIF4QlCEoDA

## Edge Functions (7 adet, hepsi verify_jwt: false)
| Fonksiyon | Model | Görev |
|---|---|---|
| moderate-text (v8) | Claude Haiku 4.5 | Metin moderasyonu |
| moderate-image (v8) | Claude Sonnet 4.6 | Görsel moderasyonu |
| validate-academic (v6) | Claude Sonnet 4.6 | Üniversite/bölüm/ders doğrulama |
| delete-account (v4) | — | Kullanıcı kendi hesabını silme |
| admin-delete-user (v4) | — | Admin kullanıcı silme |
| get-turnstile-key (v2) | — | Cloudflare Turnstile site key |
| verify-turnstile (v2) | — | Turnstile doğrulama |

## Gerekli Secrets (Supabase Edge Function Secrets)
- ANTHROPIC_API_KEY — AI fonksiyonları için (eklendi)
- TURNSTILE_SITE_KEY — Bot koruması
- TURNSTILE_SECRET_KEY — Bot koruması
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — otomatik

## Vercel Environment Variables
- VITE_SUPABASE_PROJECT_ID
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

## Bilinen Sorunlar
- [ ] AI fonksiyonları "servis çalışmıyor" hatası — edge function 200 dönüyor ama frontend hatalı gösteriyor olabilir, debug devam ediyor
- [ ] Custom SMTP ayarlanmadı — e-postalar spam'a düşebilir
- [x] verify_jwt sorunu — tüm fonksiyonlar false ile deploy edildi
- [x] vercel.json SPA routing — eklendi
- [x] Auth redirect URL — eklendi
- [x] academic_suggestions_type_check — düzeltildi
- [x] notify_posts column — eklendi

## Çalışma Kuralları
- Daima Türkçe konuş
- Önce yap, sonra açıkla — gereksiz soru sorma
- Önceki sohbetlerde çözülmüş konuları tekrar sorma
- Edge function deploy ederken her zaman verify_jwt: false kullan (fonksiyonlar kendi auth'larını yapıyor)
- Migration için apply_migration kullan, execute_sql kullanma

## Son Güncelleme
2026-03-29 — validate-academic v6 (error logging eklendi), moderate-text v8, moderate-image v8