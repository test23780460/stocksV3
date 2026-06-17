# API Notes

The browser never calls private market-data providers directly. Frontend refresh and status actions call local Next.js API routes, and those routes decide whether to use Demo Mode or server-side provider adapters.

## Public Routes

- `GET /api/status`
- `GET /api/markets`
- `GET /api/market`
- `GET /api/assets/:symbol`
- `GET /api/quote?symbol=AAPL`
- `GET /api/history?symbol=AAPL&range=1Y&interval=1D`
- `GET /api/search?q=Apple`
- `GET /api/news?symbol=MSFT&q=ai`
- `GET /api/crypto/quote?id=bitcoin`
- `GET /api/crypto/history?id=bitcoin&range=1Y`
- `GET /api/admin/diagnostics` returns `401` without a Supabase session and `403` without an admin role.

All query-bearing routes validate input with Zod and return `400` for malformed symbols, ids, ranges, or intervals.

## Provider Order

Stocks use Finnhub, then Twelve Data, then Alpha Vantage, then stale cache, then Demo Mode.

Crypto uses CoinGecko, then stale cache, then Demo Mode. CoinGecko `market_chart` responses are treated as price-series data, not fabricated OHLC candles.

Range-specific history requests normalize to backend intervals such as `5m` for `1D`, `30m` for `5D`, `1W` for `5Y`, and `1M` for `MAX` where providers support those intervals.

## Mutating Or Job Routes

- `POST /api/refresh`
- `GET|POST /api/alerts`
- `GET|POST /api/ingest`

`POST /api/refresh` returns the refreshed market payload directly so the browser does not immediately repeat the same provider cycle.

`GET|POST /api/ingest` writes to Supabase only when `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are configured; otherwise it returns honest zero-write counts.

All route responses may include provider configuration status, but never the secret values themselves.
