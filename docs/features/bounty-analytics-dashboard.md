# Bounty Analytics Dashboard

> Last updated: 2026-04-08

## Overview

The Bounty Analytics Dashboard surfaces time-series bounty volume and payout data, contributor growth and retention metrics, and downloadable CSV/PDF reports. Data is **seeded in the monorepo FastAPI app** until the primary API (`solfoundry-api`) exposes production metrics.

## Architecture

| Layer | Location |
|-------|----------|
| API | `backend/main.py`, `backend/routers/analytics.py` |
| UI | `frontend/src/pages/BountyAnalyticsPage.tsx`, route `/analytics` |
| Client helpers | `frontend/src/api/analytics.ts`, `frontend/src/hooks/useBountyAnalytics.ts` |

## API (FastAPI)

Base path: `/api` (proxied from Vite dev server on port 5173 to backend port 8000).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/bounty-volume` | JSON array of `{ date, count }` (daily, seed) |
| GET | `/api/analytics/payouts` | JSON array of `{ date, amountUsd }` |
| GET | `/api/analytics/contributors` | JSON: `new_contributors_last_30d`, `active_contributors_last_30d`, `retention_rate`, `weekly_growth[]` |
| GET | `/api/analytics/reports/export.csv` | CSV attachment |
| GET | `/api/analytics/reports/export.pdf` | PDF attachment |

Also: `GET /health` (Docker healthcheck), `GET /` welcome JSON.

## Frontend

- Navigate to **`/analytics`** (link in the main navbar: “Analytics”).
- Charts use **Recharts**; exports use anchor `href` to the export endpoints above.

## Configuration

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Optional absolute API origin for production builds; leave unset in dev to use the Vite proxy |

## Local development

1. Backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`
2. Frontend: `cd frontend && npm run dev` (opens `http://localhost:5173`, proxies `/api` to 8000)

## Testing

- Python: `cd backend && pip install -r requirements-dev.txt && pytest`
- Frontend (configured suites): `cd frontend && npm test`

## References

- Closes issue #859
