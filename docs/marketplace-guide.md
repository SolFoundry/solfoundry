# Marketplace Guide

SolFoundry's **Repo Marketplace** lets communities discover GitHub repositories and pool funds toward specific features or improvements.

## Features

- **Repo Discovery** — Search GitHub repos registered on SolFoundry, filter by language and star count.
- **Funding Goals** — Anyone can create a funding goal for a repo (e.g., "Add dark mode – 500 USDC").
- **Contributions** — Contribute USDC or FNDRY tokens to active goals. When the target is reached the goal is marked completed.
- **Payment Distribution** — Completed goals can be distributed, transferring funds to contributors.
- **Leaderboard** — See top contributors per repo ranked by total contributed.

## API Reference

Base path: `/api/marketplace`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/repos` | Search repos (query params: `q`, `language`, `min_stars`, `sort`, `page`, `limit`) |
| GET | `/repos/{id}` | Get repo details |
| POST | `/repos` | Register a GitHub repo (`{ "github_id": 12345 }`) |
| POST | `/repos/{id}/funding-goals` | Create a funding goal |
| GET | `/funding-goals` | List goals (query params: `repo_id`, `status`, `page`, `limit`) |
| GET | `/funding-goals/{id}` | Get goal with contributions |
| POST | `/funding-goals/{id}/contribute` | Contribute to a goal |
| POST | `/funding-goals/{id}/distribute` | Distribute a completed goal |
| GET | `/repos/{id}/leaderboard` | Top contributors |

## Frontend

The marketplace page is at `frontend/src/pages/Marketplace.tsx`. Add a route to your router:

```tsx
import Marketplace from './pages/Marketplace';
// In your routes:
<Route path="/marketplace" element={<Marketplace />} />
```

## Database

Schema is in `automaton/marketplace_schema.sql`. The backend auto-initializes the SQLite tables on import.

## Bounty

This feature satisfies **Bounty #857 – GitHub Repo Marketplace** (1M $FNDRY, Tier T3).
