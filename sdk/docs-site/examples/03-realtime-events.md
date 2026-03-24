# 03 — Subscribe to Real-Time Events

Connect to the WebSocket and receive live marketplace events.

```typescript
import { EventSubscriber } from '@solfoundry/sdk';

const events = new EventSubscriber({
  wsUrl: 'wss://api.solfoundry.io/ws',
  token: process.env.SOLFOUNDRY_TOKEN,
  autoReconnect: true,
  reconnectDelayMs: 3_000,
  maxReconnectAttempts: 10,
});

// Connection lifecycle
events.onConnect(() => {
  console.log('Connected to SolFoundry events');

  // Subscribe to platform-wide bounty events
  events.subscribe('bounties');

  // Subscribe to a specific bounty
  events.subscribe('my-bounty-uuid');
});

events.onDisconnect(() => {
  console.log('Disconnected — will auto-reconnect');
});

events.onError((err) => {
  console.error('WebSocket error:', err);
});

// Event handlers
events.on('bounty_created', (event) => {
  const b = event.data;
  console.log(`🆕 New bounty: [T${b.tier}] ${b.title} — ${b.reward_amount} $FNDRY`);
});

events.on('bounty_completed', (event) => {
  console.log(`✅ Bounty completed: ${event.data.title}`);
});

events.on('submission_approved', (event) => {
  console.log(`🎉 Submission approved for bounty ${event.data.bounty_id}`);
});

// Connect
await events.connect();

// Later: clean up
// events.unsubscribe('my-bounty-uuid');
// events.disconnect();
```
