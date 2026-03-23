# Treasury admin dashboard

Read-only admin view at **`/admin?section=treasury`** (after GitHub OAuth or admin API key login).

## Access control

1. **Admin auth** — Same Bearer token as other `/api/admin/*` routes (GitHub user in `ADMIN_GITHUB_USERS` or `ADMIN_API_KEY`).
2. **Owner wallet (production)** — Set `TREASURY_OWNER_WALLETS` on the API to a comma-separated list of Solana addresses. The browser must send header `X-SF-Treasury-Wallet` with a matching connected wallet (the frontend sets this from the active wallet when `VITE_TREASURY_OWNER_WALLETS` is non-empty). If `TREASURY_OWNER_WALLETS` is empty, only admin auth is required (local dev).

Align `VITE_TREASURY_OWNER_WALLETS` with `TREASURY_OWNER_WALLETS` so the UI gate matches the API.

## Configuration

| Variable | Where | Purpose |
|----------|--------|---------|
| `TREASURY_PDA_WALLET` | Backend | On-chain address whose $FNDRY balance is shown (defaults to `TREASURY_WALLET`). |
| `TREASURY_OWNER_WALLETS` | Backend | Allowed owner wallets for the treasury dashboard endpoint. |
| `VITE_TREASURY_OWNER_WALLETS` | Frontend | Same list for connect-wallet gating. |

## Behaviour

- **Balance** — $FNDRY via Solana RPC for the configured treasury / PDA address.
- **Chart** — Inflow from recorded buybacks; outflow from confirmed FNDRY payouts (daily / weekly / monthly buckets).
- **Runway** — `current_balance / avg_daily_outflow` over the last 30 days of FNDRY outflows.
- **Tier spending** — Sum of `reward_amount` for bounties in `paid` status, grouped by tier.
- **CSV export** — Recent transactions plus a `tier_spending` section in the same file.
- **Auto-refresh** — React Query refetches every 30 seconds.

No escrow fund, payout, or transfer actions are exposed from this UI.

## API

`GET /api/admin/treasury/dashboard` — response model `TreasuryDashboardResponse` (see `backend/app/api/admin.py`).
