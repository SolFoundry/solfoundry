/**
 * Example 03: Subscribe to real-time marketplace events via WebSocket.
 *
 * Run: npx tsx examples/03-realtime-events.ts
 * Press Ctrl+C to disconnect.
 */

import { EventSubscriber } from '../src/index.js';

const events = new EventSubscriber({
  wsUrl: process.env.SOLFOUNDRY_WS_URL ?? 'wss://api.solfoundry.io/ws',
  token: process.env.SOLFOUNDRY_TOKEN,
  autoReconnect: true,
});

events.onConnect(() => {
  console.log('Connected. Subscribing to bounty events…');
  events.subscribe('bounties');
});

events.onDisconnect(() => console.log('Disconnected.'));
events.onError((err) => console.error('Error:', err));

events.on('bounty_created', (e) => console.log('🆕 New bounty:', e.data));
events.on('bounty_completed', (e) => console.log('✅ Completed:', e.data));
events.on('submission_approved', (e) => console.log('🎉 Approved:', e.data));

await events.connect();
console.log('Listening for events… (Ctrl+C to stop)\n');
