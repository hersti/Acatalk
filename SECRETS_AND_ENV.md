# AcaTalk - Secrets ve Environment Variables

Bu dosya yalnizca degisken adlarini ve kullanim amacini tutar. Gercek secret degerleri burada tutulmaz.

## 1) Supabase Edge Function Secrets

Supabase Dashboard -> Settings -> Edge Functions -> Secrets

| Secret Name | Nerede Kullanilir | Aciklama | Zorunlu |
|---|---|---|---|
| SUPABASE_URL | Edge Functions | Supabase proje URL'i | Evet |
| SUPABASE_ANON_KEY | Edge Functions | Publishable/anon key | Evet |
| SUPABASE_SERVICE_ROLE_KEY | Edge Functions | Admin erisim anahtari | Evet |
| TURNSTILE_SITE_KEY | Edge Functions | Cloudflare Turnstile site key | Turnstile varsa evet |
| TURNSTILE_SECRET_KEY | Edge Functions | Cloudflare Turnstile secret key | Turnstile varsa evet |

## 2) AI Secret'lari

Sistemde aktif AI kullanan tek edge function `validate-academic` oldugu icin,
aktif secret seti su sekildedir:

| Secret Name | Nerede Kullanilir | Aciklama | Zorunlu |
|---|---|---|---|
| ANTHROPIC_API_KEY | validate-academic | Department/course dogrulama | Evet |
| ANTHROPIC_MODEL | validate-academic | Model override | Hayir |

Not:
- Lovable gateway ve `LOVABLE_API_KEY` aktif yapida kullanilmaz.
- Aktif olmayan provider secret'lari zorunlu gibi listelenmemelidir.

## 3) Frontend Environment Variables (.env / Vercel)

| Variable | Nerede Kullanilir | Aciklama | Zorunlu |
|---|---|---|---|
| VITE_SUPABASE_PROJECT_ID | Frontend | Supabase proje ref ID | Evet |
| VITE_SUPABASE_URL | Frontend | Supabase proje URL | Evet |
| VITE_SUPABASE_PUBLISHABLE_KEY | Frontend | Supabase publishable key | Evet |

## 4) Kullanim Kurallari

- Gercek secret degerlerini bu dosyaya yazma.
- Sadece aktif degiskenleri ve gorevlerini tut.
- Yeni servis/provider eklendiginde dosyayi guncelle.
- Frontend ve backend degiskenlerini karistirma.
