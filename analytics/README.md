# SolFoundry — Contributor Analytics Platform

> Real-time analytics dashboard showing contributor performance, bounty completion rates, and reward distribution across the SolFoundry platform.

## Features

- 📊 **Activity over time** — daily submissions and completions with area chart
- 🏆 **Top contributors** — leaderboard with reputation, completions, and earnings
- 🎯 **Completion rates** — breakdown by tier (T1/T2/T3) with pie + stacked bar
- 💰 **Reward trends** — daily $FNDRY reward payouts over the last 30 days
- 🔍 **Search & filter** — real-time search by GitHub handle, filter by tier
- 📱 **Responsive** — works on desktop, tablet, and mobile

## Tech Stack

- **React 18** + TypeScript
- **Recharts** for data visualisation (AreaChart, BarChart, LineChart, PieChart)
- **Vite** for development and production bundling
- SolFoundry REST API (`/v1/stats/*`, `/v1/contributors`)

## Getting Started

```bash
cd analytics
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Build

```bash
npm run build
# Output in analytics/dist/
```

## Configuration

Set `VITE_API_URL` to point at the SolFoundry API:

```bash
# .env.local
VITE_API_URL=https://api.solfoundry.io
```

Defaults to `https://api.solfoundry.io` if not set.

## Project Structure

```
analytics/
├── src/
│   ├── api.ts         — API client (fetchContributors, fetchDailyActivity, etc.)
│   ├── charts.tsx     — Recharts components (ActivityChart, TopContributorsChart, etc.)
│   └── dashboard.tsx  — Main dashboard page (ContributorAnalyticsDashboard)
├── package.json
└── README.md
```

## API Endpoints Used

| Endpoint                    | Purpose                                     |
|-----------------------------|---------------------------------------------|
| `GET /v1/contributors`      | Paginated contributor list with filters     |
| `GET /v1/contributors/:id`  | Single contributor profile                  |
| `GET /v1/stats/activity`    | Daily activity data (submissions/completions)|
| `GET /v1/stats/completions` | Bounty completion rates by tier             |
| `GET /v1/stats/platform`    | High-level platform metrics summary         |
