# SolFoundry — Full-stack Admin Dashboard

> Internal admin interface for managing bounties, contributors, treasury, and platform operations.

## Features

- 📊 **Overview** — live metrics: active bounties, contributors, treasury balance, open disputes
- 🏆 **Bounty Management** — create, update, close bounties; approve/reject submissions
- 👥 **Contributor Management** — approve pending contributors, ban bad actors, add admin notes
- 💰 **Treasury view** — total balance, pending payouts, locked escrow, lifetime paid out
- 🔍 **Search & filter** — real-time search across bounties and contributors
- ⚡ **Quick actions** — one-click approve/close/ban from the table

## Tech Stack

- **React 18** + TypeScript
- **Vite** for development and production builds
- SolFoundry Admin REST API (`/admin/*`)

## Getting Started

```bash
cd admin
npm install
npm run dev
```

Open [http://localhost:5174](http://localhost:5174)

### Authentication

The dashboard reads `admin_token` from `localStorage`. Set it after login:

```js
localStorage.setItem('admin_token', 'your-admin-jwt-token');
```

## Build

```bash
npm run build
# Output in admin/dist/
```

## Configuration

```bash
# .env.local
VITE_API_URL=https://api.solfoundry.io
```

## Project Structure

```
admin/
├── src/
│   ├── api/
│   │   └── index.ts          — Admin API client (all admin endpoints)
│   └── pages/
│       ├── index.tsx          — Overview page (stats + treasury + quick actions)
│       ├── bounties.tsx       — Bounty CRUD + status management
│       └── contributors.tsx   — Contributor approval, ban, notes
├── README.md
└── package.json (to be added)
```

## API Endpoints Used

| Method | Endpoint                            | Purpose                          |
|--------|-------------------------------------|----------------------------------|
| GET    | /admin/stats                        | Platform overview metrics        |
| GET    | /admin/bounties                     | List bounties (search/filter)    |
| POST   | /admin/bounties                     | Create new bounty                |
| PATCH  | /admin/bounties/:id                 | Update bounty fields             |
| POST   | /admin/bounties/:id/close           | Close a bounty                   |
| GET    | /admin/contributors                 | List contributors (search/filter)|
| POST   | /admin/contributors/:id/approve     | Approve pending contributor      |
| POST   | /admin/contributors/:id/ban         | Ban contributor with reason      |
| PATCH  | /admin/contributors/:id             | Update notes/fields              |

## Access Control

All `/admin/*` endpoints require an admin JWT token. Only accounts with `role: admin` in the database can access admin routes. Non-admin tokens receive `403 Forbidden`.
