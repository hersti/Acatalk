# AcaTalk - Proje Baglami

## Proje Bilgileri
- Proje: AcaTalk
- Site: https://acatalk.vercel.app
- Stack: React + Vite + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Vercel
- GitHub: https://github.com/hersti/Acatalk

## Servis Kimlikleri
- Supabase Project ID: lueodetbmvrcxeinxvxb
- Supabase Region: eu-central-1
- Vercel Project ID: prj_4nTJuf8ERtlUIygzxuJHuBczRvhk
- Vercel Team ID: team_uIEpd3aGxN9V1dIF4QlCEoDA

## Edge Functions (verify_jwt: false)
| Fonksiyon | Saglayici | Gorev |
|---|---|---|
| validate-academic | Anthropic | Bolum / ders dogrulama |
| moderate-text | Rule-based | Metin moderasyonu |
| moderate-image | Rule-based | Gorsel URL moderasyonu |
| check-username | DB + kurallar | Username format/rezerve/benzersizlik |
| delete-account | - | Kullanici kendi hesabini silme |
| admin-delete-user | - | Admin kullanici silme |
| get-turnstile-key | - | Cloudflare Turnstile site key |
| verify-turnstile | - | Turnstile dogrulama |

## Gerekli Secrets
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY (validate-academic)
- ANTHROPIC_MODEL (opsiyonel)
- TURNSTILE_SITE_KEY
- TURNSTILE_SECRET_KEY

## Vercel Environment Variables
- VITE_SUPABASE_PROJECT_ID
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY

## Operasyon Notlari
- Universite kabulu yalnizca domain->university DB eslesmesi ile yapilir.
- Unknown university/domain akisi admin onaylidir.
- Bolum dogrulama `approved | rejected | error` semantigindedir.
- Edge function deploylarinda verify_jwt: false korunur.
- Migration uygulamasi `apply_migration` ile yapilir.
