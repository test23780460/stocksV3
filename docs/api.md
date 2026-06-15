# API Notes

The browser never calls private market-data providers directly. Frontend refresh and status actions call local Next.js API routes, and those routes decide whether to use Demo Mode or server-side provider adapters.

## Public Routes

- `GET /api/status`
- `GET /api/market`
- `GET /api/assets/:symbol`
- `GET /api/news?symbol=MSFT&q=ai`

## Mutating Or Job Routes

- `POST /api/refresh`
- `GET|POST /api/alerts`
- `GET|POST /api/ingest`

All route responses may include provider configuration status, but never the secret values themselves.
