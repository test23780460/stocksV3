# Market Signal Deck

Market Signal Deck is a GitHub Pages-ready React, TypeScript, and Vite market research dashboard. It combines the newer Stocks V2 visual shell with the older Market Signal Deck scanner concepts: Market Mood, Market Command Deck, Heat Map Wall, Whale Radar, Hype vs Risk, Red Flag Detector, News Impact Desk, Predictions, scenario estimates, watchlists, alerts, glossary, and an admin control room.

Educational market research only. Nothing in this project is financial advice. Predictions are estimates and are not guarantees. The application does not execute trades, accept deposits, connect brokerage accounts, or include paper trading.

## Screenshots

Run the app locally and capture these pages after setup:

- Launch: `/#Launch`
- Dashboard
- Markets asset detail
- News
- Predictions
- Admin Dashboard

## Architecture

- Static frontend: React 18, TypeScript, Vite, Lightweight Charts, CSS design system
- Hosting: GitHub Pages with repository-subpath base support
- Routing: client-side route state with hash-safe deployment behavior
- Demo data: deterministic fixtures with fixed timestamps and visible Demo Mode badges
- Secure backend jobs: GitHub Actions scripts read private provider keys from repository secrets
- Persistent storage: Supabase Postgres, Supabase Auth, and RLS migrations

## Data Flow

1. Frontend reads public Supabase data or deterministic demo fixtures.
2. Browser never calls private-key market providers.
3. GitHub Actions read provider secrets.
4. Actions validate, normalize, calculate, and write market data using `SUPABASE_SERVICE_ROLE_KEY`.
5. Frontend displays Live, Delayed, Cached, Stale, Demo, or error states with provider and timestamp metadata.
6. User refresh requests are designed to go into `scan_requests` and be processed by the next secure workflow run.

GitHub Actions schedules can run later than the exact cron minute. The five-minute ingestion workflow is idempotent and can also be run manually.

## Local Installation

This repo uses pnpm.

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

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_URL`
- `VITE_GITHUB_PAGES_BASE_PATH`

Private GitHub Actions secrets:

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

Only `VITE_*` values are bundled into the frontend. Never place private provider keys in `VITE_*`.

## GitHub Secrets Setup

Go to GitHub Repository -> Settings -> Secrets and variables -> Actions -> New repository secret.

Add private values there. Do not commit `.env`, service-role keys, provider keys, Discord webhook URLs, or GitHub tokens.

## Supabase Setup

1. Create a Supabase project.
2. In SQL editor or Supabase CLI, apply migrations in `supabase/migrations` in filename order.
3. Enable Supabase Auth email/password.
4. Add your public anon config to GitHub Pages variables or local `.env`.
5. Add service-role and provider secrets only to GitHub Actions secrets.

RLS allows users to read public market information and manage only their own profiles, settings, watchlists, alert rules, and scan requests. Trusted market data writes are performed by GitHub Actions with the service-role key.

## Workflows

- `ci.yml`: install, typecheck, test, secret scan, build
- `pages-deploy.yml`: build and deploy to GitHub Pages
- `market-ingestion.yml`: approximately every five minutes plus manual dispatch
- `historical-backfill.yml`: manual symbol/list/universe backfill
- `prediction-jobs.yml`: scheduled and manual prediction generation/evaluation
- `daily-summary.yml`: scheduled summary and optional Discord notification
- `data-quality.yml`: stale/gap/suspicious-value checks
- `security.yml`: audit and secret scan

Manual workflow runs are available from GitHub -> Actions -> select workflow -> Run workflow.

## GitHub Pages Setup

1. Push the repository to GitHub.
2. Go to Settings -> Pages.
3. Source: GitHub Actions.
4. Confirm the repository name base path. For `test23780460/stocksV3`, the base path is `/stocksV3/`.
5. The production URL should be `https://test23780460.github.io/stocksV3/`.

## Provider Setup

Current implementation includes a deterministic demo provider and workflow placeholders. Live provider adapters should implement `MarketDataProvider` and `NewsProvider` in `src/providers/types.ts`, validate responses, normalize fields, and write to Supabase from GitHub Actions.

## Historical Backfill

Run `Historical Backfill` manually. Inputs:

- `symbol`
- `symbols`
- `start_date`
- `end_date`

The demo job prepares deterministic bars and logs missing/write status honestly. Live storage requires provider and Supabase service-role secrets.

## Market Ingestion

`Market Ingestion` runs on `*/5 * * * *` and supports manual `symbols`. It is designed to be safe to rerun, batch assets, and log success/failure counts without exposing keys.

## Prediction Jobs

`Prediction Jobs` generates and evaluates deterministic ruleset predictions in demo mode. Production predictions should write immutable rows to `predictions` and outcomes to `prediction_outcomes`.

## Daily Summary And Discord

`Daily Summary` reads stored market/news data and can send admin-owner alerts only when `DISCORD_WEBHOOK_URL` is configured as a GitHub secret. The webhook is never exposed to the frontend.

## Demo Mode

The project builds before keys are added. Demo Mode uses fixed fixture assets, timestamps, news, charts, predictions, and provider states. It is visibly labeled and never claimed as live data.

## Adding A Provider

1. Implement the `MarketDataProvider` or `NewsProvider` interface.
2. Validate raw responses with schemas.
3. Normalize to project types.
4. Redact all logs.
5. Write only through GitHub Actions and Supabase service role.
6. Add provider status reporting.

## Security Checklist

- Run `pnpm run security:secrets`.
- Confirm private values are not in `.env.example`, `src`, `public`, `dist`, workflow logs, source maps, or static JSON.
- Confirm Vite sourcemaps are disabled for production.
- Rotate any exposed key immediately.

## Known Limitations

- Live market provider adapters are scaffolded but not connected to real APIs yet.
- Supabase Auth UI is disabled until public Supabase values are configured.
- E2E tests are not yet implemented; current tests cover unit and launch-render behavior.
- Options data is intentionally unavailable until a provider supports chains and Greeks.
- Demo fixture history is representative and deterministic, not a real five-year provider backfill.

## Git Commands

```bash
git remote add origin https://github.com/test23780460/stocksV3.git
git add .
git commit -m "Build Market Signal Deck V3"
git branch -M main
git push -u origin main
```

