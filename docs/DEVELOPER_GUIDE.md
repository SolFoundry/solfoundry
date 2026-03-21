# SolFoundry Developer Guide

## Getting Started

This guide helps you integrate with the SolFoundry API.

## Quick Start

### 1. Authenticate

#### Option A: GitHub OAuth

```bash
# Step 1: Get authorization URL
GET /auth/github/authorize?state=your_state

Response:
{
  "authorize_url": "https://github.com/login/oauth/authorize?client_id=...",
  "state": "generated_state"
}

# Step 2: Exchange code for tokens
POST /auth/github
Content-Type: application/json

{
  "code": "github_authorization_code"
}

Response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### Option B: Wallet Authentication

```bash
# Step 1: Get auth message
GET /auth/wallet/message?wallet_address=YourSolanaAddress

Response:
{
  "message": "Sign this message to authenticate with SolFoundry: ...timestamp...",
  "nonce": "unique_nonce"
}

# Step 2: Sign message with wallet and submit
POST /auth/wallet
Content-Type: application/json

{
  "wallet_address": "YourSolanaAddress",
  "signature": "base58_encoded_signature",
  "message": "message_from_step_1"
}

Response:
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

### 2. List Bounties

```bash
GET /api/bounties?status=open&tier=1&limit=10

Response:
{
  "items": [
    {
      "id": " bounty_123",
      "title": "Fix login bug",
      "description": "Users cannot login with...",
      "status": "open",
      "tier": 1,
      "reward_amount": 100000,
      "reward_token": "FNDRY",
      "skills": ["python", "fastapi"],
      "repository": "org/repo",
      "created_by": "wallet_address",
      "created_at": "2026-03-20T12:00:00Z",
      "deadline": "2026-04-20T12:00:00Z"
    }
  ],
  "total": 50,
  "skip": 0,
  "limit": 10
}
```

### 3. Create a Bounty

```bash
POST /api/bounties
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "title": "Add user profile feature",
  "description": "Implement user profile page with avatar upload",
  "tier": 2,
  "reward_amount": 250000,
  "skills": ["react", "typescript", "nodejs"],
  "repository": "solfoundry/frontend",
  "category": "feature",
  "deadline": "2026-04-15T00:00:00Z"
}

Response:
{
  "id": "bounty_456",
  "title": "Add user profile feature",
  "status": "open",
  "tier": 2,
  "reward_amount": 250000,
  ...
}
```

### 4. Submit a Solution

```bash
POST /api/bounties/bounty_123/submit
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "pr_url": "https://github.com/org/repo/pull/42",
  "description": "Fixed the login issue by..."
}

Response:
{
  "id": "submission_789",
  "bounty_id": "bounty_123",
  "pr_url": "https://github.com/org/repo/pull/42",
  "submitted_by": "wallet_address",
  "status": "pending",
  "submitted_at": "2026-03-20T15:00:00Z"
}
```

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/github/authorize` | Get GitHub OAuth URL |
| POST | `/auth/github` | Exchange OAuth code |
| GET | `/auth/wallet/message` | Get wallet signing message |
| POST | `/auth/wallet` | Authenticate with wallet |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user |

### Bounty Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bounties` | List bounties |
| POST | `/api/bounties` | Create bounty |
| GET | `/api/bounties/{id}` | Get bounty details |
| PATCH | `/api/bounties/{id}` | Update bounty |
| DELETE | `/api/bounties/{id}` | Delete bounty |
| POST | `/api/bounties/{id}/submit` | Submit solution |
| GET | `/api/bounties/{id}/submissions` | List submissions |
| GET | `/api/bounties/search` | Search bounties |
| GET | `/api/bounties/hot` | Get hot bounties |
| GET | `/api/bounties/recommended` | Get recommended |

### Escrow API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/escrow/fund` | Fund escrow |
| POST | `/api/escrow/release` | Release to contributor |
| POST | `/api/escrow/refund` | Refund to creator |

### WebSocket Events

```javascript
// Connect to WebSocket
const ws = new WebSocket('wss://api.solfoundry.org/ws');

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['bounties', 'submissions']
}));

// Receive events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.payload);
};
```

**Event Types:**
- `bounty_created` - New bounty posted
- `bounty_updated` - Status changed
- `submission_new` - New PR submitted
- `submission_status` - Review completed
- `payout_completed` - Payment sent

### Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid/missing token |
| 403 | Forbidden - Not authorized |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Duplicate or conflict |
| 429 | Too Many Requests - Rate limited |
| 500 | Server Error |

Example error:
```json
{
  "detail": "Bounty not found"
}
```

## Rate Limits

- **Authenticated**: 1000 requests/minute
- **Public**: 100 requests/minute
- **WebSocket**: 10 connections/IP

## SDK Examples

### JavaScript/TypeScript

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const client = new SolFoundry({
  accessToken: 'YOUR_TOKEN'
});

// List bounties
const bounties = await client.bounties.list({ tier: 1 });

// Create bounty
const bounty = await client.bounties.create({
  title: 'New Feature',
  tier: 2,
  reward_amount: 500000
});
```

### Python

```python
from solfoundry import SolFoundry

client = SolFoundry(access_token="YOUR_TOKEN")

# List bounties
bounties = client.bounties.list(tier=1)

# Create bounty
bounty = client.bounties.create(
    title="New Feature",
    tier=2,
    reward_amount=500000
)
```

## Support

- Discord: https://discord.gg/solfoundry
- GitHub: https://github.com/SolFoundry/solfoundry/issues
- Email: support@solfoundry.org
