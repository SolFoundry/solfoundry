# SolFoundry WebSocket Activity Feed

Production-oriented reference implementation for GitHub issue `#860`.

## Structure

- `server/`: Express + Socket.io backend with room-based subscriptions, throttled broadcasting, and polling endpoint.
- `client/`: React + TypeScript feed UI with resilient connection management.
- `shared/`: Common event contracts and payload types.
- `docs/`: API and architecture notes.

## Run locally

```bash
npm install
npm run build
npm run dev
```

Server defaults to `http://localhost:4000`.
Client defaults to `http://localhost:5173`.

## Key capabilities

- Real-time broadcasting for bounty, submission, review, and leaderboard events
- Room-based filtering by activity type, actor, and bounty
- Notification preference syncing
- Exponential backoff reconnect strategy with HTTP polling fallback
- Throttled event flush and lightweight rate limiting
