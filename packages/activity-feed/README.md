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

Server defaults to port `4000` and allows `CLIENT_ORIGIN=http://localhost:5174` by default.
Client defaults to port `5174` to avoid colliding with the main frontend.
The client derives its activity endpoint from the current host and server port unless `VITE_WS_ENDPOINT` is set.

For event ingestion, set `ACTIVITY_FEED_API_KEY` (or `ACTIVITY_FEED_INGEST_API_KEY`) and send it as `x-api-key` on `POST /api/activities`. Ingestion fails closed when no key is configured; local-only demos can opt out with `ACTIVITY_FEED_REQUIRE_API_KEY=false`.
If the server is behind a trusted reverse proxy, set `ACTIVITY_FEED_TRUST_PROXY` to `true` or an Express preset such as `loopback`; otherwise it stays disabled to avoid trusting spoofable forwarding headers.

## Key capabilities

- Real-time broadcasting for bounty, submission, review, and leaderboard events
- Room-based filtering by activity type, actor, and bounty
- Notification preference syncing
- Exponential backoff reconnect strategy with HTTP polling fallback
- Throttled event flush and lightweight rate limiting
