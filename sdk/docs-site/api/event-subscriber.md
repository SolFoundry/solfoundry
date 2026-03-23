# EventSubscriber

WebSocket subscription client with automatic reconnection.

## Constructor

```typescript
new EventSubscriber(config: EventSubscriberConfig)
```

### Config

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `wsUrl` | `string` | — | **Required.** WebSocket URL |
| `token` | `string` | — | Auth token |
| `autoReconnect` | `boolean` | `true` | Reconnect on disconnect |
| `reconnectDelayMs` | `number` | `3000` | Delay between reconnects |
| `maxReconnectAttempts` | `number` | `10` | Max reconnect attempts |

## Methods

### `connect()`

```typescript
connect(): Promise<void>
```

### `disconnect()`

```typescript
disconnect(): void
```

### `subscribe(topic)`

```typescript
subscribe(topic: string): void
```

### `unsubscribe(topic)`

```typescript
unsubscribe(topic: string): void
```

### `on(event, handler)`

```typescript
on(event: string, handler: EventHandler): void
```

### `onConnect(handler)`

```typescript
onConnect(handler: ConnectionHandler): void
```

### `onDisconnect(handler)`

```typescript
onDisconnect(handler: ConnectionHandler): void
```

### `onError(handler)`

```typescript
onError(handler: ErrorHandler): void
```

## Example

```typescript
const events = new EventSubscriber({
  wsUrl: 'wss://api.solfoundry.io/ws',
  token: 'auth-token',
  autoReconnect: true,
});

events.on('bounty_created', (event) => {
  console.log('New bounty:', event.data.title);
});

events.onConnect(() => {
  events.subscribe('my-bounty-id');
});

await events.connect();
```
