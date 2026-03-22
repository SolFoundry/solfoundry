# SolFoundry Admin Dashboard

Full-stack administration interface for the SolFoundry bounty platform. Manage bounties, contributors, and treasury from a single unified dashboard.

## Features

- **Overview Dashboard** — real-time stats (total bounties, active contributors, treasury balance, total paid out) with activity feed
- **Bounty Management** — paginated table with filters by status/tier, create/edit/close actions, status badges
- **Contributor Management** — reputation scores, approve/ban controls, contribution history modal
- **Treasury Monitoring** — on-chain balance tracking and payout history
- **Secure API Client** — JWT auth with auto-refresh and interceptors

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| State | Zustand + React Query |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| HTTP | Axios |

## Prerequisites

- Node.js ≥ 18
- pnpm ≥ 8 (or npm/yarn)
- SolFoundry backend running on port 8000

## Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ADMIN_SECRET=your-admin-jwt-secret
```

## Development

```bash
pnpm dev       # starts on http://localhost:3001
pnpm build     # production build
pnpm start     # serve production build
pnpm lint      # eslint
pnpm type-check  # tsc --noEmit
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8000` |
| `NEXT_PUBLIC_ADMIN_SECRET` | Admin JWT secret for auth header | — |
| `NEXT_PUBLIC_REFRESH_INTERVAL` | Dashboard refresh interval (ms) | `30000` |

## Directory Structure

```
admin/
├── src/
│   ├── pages/
│   │   ├── index.tsx          # Overview dashboard
│   │   ├── bounties.tsx       # Bounty management
│   │   └── contributors.tsx   # Contributor management
│   ├── components/
│   │   └── StatsCard.tsx      # Reusable stats card
│   └── api/
│       └── client.ts          # Axios API client
├── package.json
└── README.md
```

## API Authentication

All requests include an `Authorization: Bearer <token>` header. The token is obtained from the `/admin/auth/login` endpoint and stored in localStorage. Expired tokens trigger an automatic refresh via the Axios response interceptor.

## Deployment

```bash
# Docker
docker build -t solfoundry-admin .
docker run -p 3001:3001 --env-file .env.production solfoundry-admin

# Vercel
vercel --prod
```

## Contributing

See the main [SolFoundry contributing guide](../CONTRIBUTING.md). Admin-specific notes:
- Keep API calls in `src/api/client.ts`
- All data-fetching components should use React Query hooks
- Table columns are defined inline in each page component for clarity
