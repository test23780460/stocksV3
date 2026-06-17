# Vercel Deployment

Market Signal Deck is built for Vercel with the Next.js App Router.

## Project Settings

- Repository: `test23780460/stocksV3`
- Production branch: `main`
- Framework preset: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Output directory: managed by Next.js

## Environment Variables

Add public values with the `NEXT_PUBLIC_` prefix only when they are safe for browser JavaScript:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Add all provider keys and service keys as private Vercel variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `POLYGON_API_KEY`
- `FINNHUB_API_KEY`
- `TWELVE_DATA_API_KEY`
- `COINGECKO_API_KEY`
- `NEWS_API_KEY`
- `CRON_SECRET`

## Cron

`vercel.json` schedules `/api/ingest` once per day at `0 9 * * *` so the project can deploy on Vercel Hobby. Vercel's 2026 Cron limits allow once-per-day jobs on Hobby; Pro or Enterprise can use minute-level schedules such as `*/5 * * * *`.

If `CRON_SECRET` is set, call the route with:

```bash
Authorization: Bearer <CRON_SECRET>
```

The route logs status without printing secret values. Demo Mode stays active when provider keys are missing.

## Git Integration

Keep the GitHub integration connected so every push to `main` triggers a production deployment. Pull requests can use Vercel preview deployments.
