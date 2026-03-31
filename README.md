# AcaTalk

AcaTalk, Turkiye ve KKTC universite ogrencileri icin gelistirilen bir akademik paylasim platformudur.

## Gelistirme

Gereksinimler:
- Node.js 20+
- npm

Komutlar:
```sh
npm install
npm run dev
npm run build
```

## Ortam Degiskenleri

Frontend (`.env`):
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Supabase Edge Function secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (yalnizca `validate-academic` icin)
- `ANTHROPIC_MODEL` (opsiyonel)
- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

## Dagitim

- Frontend: Vercel
- Backend/DB: Supabase

`main` branch'e gecis sadece PR uzerinden yapilir.
