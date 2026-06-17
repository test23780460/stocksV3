# Market Signal Deck

Market Signal Deck is a Vercel-ready Next.js, React, and TypeScript market research dashboard for Stocks V3. It keeps the dark premium Robinhood-inspired feel while expanding the product into a full research command center: dashboard, stocks, crypto, ETFs, indexes, news, screeners, predictions, compare tools, watchlists, alerts, glossary, profile/settings, public status, and admin-only operations pages.

Educational market research only. Nothing in this project is financial advice. Predictions are estimates and are not guarantees. The application does not execute trades, accept deposits, connect brokerage accounts, or include paper trading.

## Architecture

- App framework: Next.js App Router, React, TypeScript, Lightweight Charts, CSS design system
- Hosting target: Vercel connected to the GitHub repository
- API routes: Vercel serverless handlers under `src/app/api`
- Cron route: `/api/ingest` scheduled once per day through `vercel.json` for Vercel Hobby compatibility
- Demo fallback: deterministic fixtures for unavailable assets, charts, news, predictions, provider health, and alerts
- Storage/auth readiness: Supabase migrations, RLS, server-side ingestion, local signed-out watchlists/alerts, and disabled auth UI until Supabase env vars are configured
- Routing: shareable Next.js URLs for dashboard, market categories, asset pages, research tools, account pages, status, and protected admin paths

## Local Installation

```bash
pnpm install
pnpm run dev
```

Build and verify:

```bash
pnpm run lint
pnpm test
pnpm run security:secrets
pnpm run build
```

## Environment Variables

Public browser variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

Private Vercel environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `POLYGON_API_KEY`
- `FINNHUB_API_KEY`
- `TWELVE_DATA_API_KEY`
- `COINGECKO_API_KEY`
- `NEWS_API_KEY`
- `DISCORD_WEBHOOK_URL`
- `CRON_SECRET`
- `MARKET_DATA_PROVIDER`
- `NEWS_DATA_PROVIDER`

Only `NEXT_PUBLIC_*` values are bundled into the frontend. Never place provider keys, service-role keys, Discord webhooks, GitHub tokens, or cron secrets in `NEXT_PUBLIC_*`.

## Vercel Deployment

1. Import `test23780460/stocksV3` into Vercel.
2. Framework preset: Next.js.
3. Install command: `pnpm install --frozen-lockfile`.
4. Build command: `pnpm run build`.
5. Add environment variables in Vercel Project Settings.
6. Keep Git integration enabled so pushes to `main` deploy automatically.

The app works before keys are added. Missing provider keys activate visible Demo Mode instead of failing or leaking errors.

## API Routes

- `GET /api/status`: public runtime/provider status with no secret values
- `GET /api/markets`: safe asset, news, and provider-status snapshot
- `GET /api/market`: compatibility alias for market snapshot
- `GET /api/assets/:symbol`: asset detail or an honest asset-not-found response
- `GET /api/quote?symbol=AAPL`: validated stock quote route
- `GET /api/history?symbol=AAPL&range=1Y&interval=1D`: range-specific stock history route
- `GET /api/search?q=Apple`: provider-backed search with demo fallback
- `GET /api/news`: filterable demo news, with `symbol` and `q` query params
- `GET /api/crypto/quote?id=bitcoin`: CoinGecko-backed crypto quote route
- `GET /api/crypto/history?id=bitcoin&range=1Y`: crypto price-series history route
- `POST /api/refresh`: user-facing refresh action that returns the refreshed market payload directly
- `GET|POST /api/alerts`: validated demo/local alert endpoint until Supabase Auth is configured
- `GET|POST /api/ingest`: Vercel cron-safe backend ingestion route
- `GET /api/admin/diagnostics`: protected admin diagnostics, 401/403 unless Supabase Auth confirms an admin role

## Demo Mode

Demo Mode uses fixed fixture assets, timestamps, news, charts, predictions, alert rules, and provider states when a provider is missing or unavailable. It is visibly labeled and never claimed as live data. Provider adapters run only in serverless routes, and private keys are never exposed to the browser.

## Supabase Setup

1. Create a Supabase project.
2. Apply migrations in `supabase/migrations` in filename order.
3. Enable Supabase Auth email/password.
4. Add public anon values to Vercel only as `NEXT_PUBLIC_*`.
5. Add service-role and provider secrets only as private Vercel environment variables.

RLS allows users to read public market information and manage only their own profiles, settings, watchlists, alert rules, and scan requests. Trusted writes should be performed only from server-side routes or trusted backend jobs.

## Security Checklist

- Run `pnpm run security:secrets`.
- Confirm private values are not in `.env.example`, `src`, `public`, `.next`, workflow logs, source maps, or static JSON.
- Keep `.vercel/` ignored.
- Rotate any exposed key immediately.

## Known Limitations

- Stock provider adapters require Vercel keys before they can return provider-supplied stock data.
- Supabase Auth UI is disabled until public Supabase values are configured.
- Notification delivery is simulated until an email, push, Discord, or webhook provider is configured.
- Options data is intentionally unavailable until a provider supports chains and Greeks.
- Vercel Hobby cron runs daily at `09:00 UTC`; more frequent schedules require a supported plan or a separate scheduler.
