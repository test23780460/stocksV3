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

## Provider Order

Stocks use Finnhub, then Twelve Data, then Alpha Vantage, then stale cache, then Demo Mode.

Crypto uses CoinGecko, then stale cache, then Demo Mode.

## Mutating Or Job Routes

- `POST /api/refresh`
- `GET|POST /api/alerts`
- `GET|POST /api/ingest`

All route responses may include provider configuration status, but never the secret values themselves.
