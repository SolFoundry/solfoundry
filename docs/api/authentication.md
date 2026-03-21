# Authentication

SolFoundry API supports multiple authentication methods for different use cases.

## Overview

| Method | Use Case | Security Level |
|--------|----------|----------------|
| Bearer Token | Production applications | High |
| X-User-ID Header | Development/Testing | Low |
| API Key | Server-to-Server | High |
| GitHub OAuth | User authentication | High |
| Solana Wallet | Web3 authentication | High |

## Bearer Token Authentication

The recommended method for production applications.

### Request Format

```bash
curl -H "Authorization: Bearer your-token-here" \
  https://api.solfoundry.org/api/notifications
```

### Token Format

Tokens are JWT (JSON Web Tokens) with the following structure:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMDAwIiwiaWF0IjoxNzA0MDY3MjAwLCJleHAiOjE3MDQxNTM2MDB9.signature
```

### Token Claims

| Claim | Description |
|-------|-------------|
| `user_id` | User's unique identifier (UUID) |
| `iat` | Issued at timestamp |
| `exp` | Expiration timestamp |
| `wallet_address` | Solana wallet address (optional) |

### Obtaining a Token

Tokens are obtained through the authentication flow:

1. Initiate OAuth flow with GitHub or Solana wallet
2. Complete authentication
3. Receive JWT token in response

## GitHub OAuth Flow

### Step 1: Redirect to GitHub

```
GET https://api.solfoundry.org/auth/github
```

This redirects to GitHub's authorization page.

### Step 2: User Authorizes

User approves the application on GitHub.

### Step 3: Callback

GitHub redirects back to your callback URL with a code:

```
https://your-app.com/callback?code=abc123
```

### Step 4: Exchange Code for Token

```bash
POST https://api.solfoundry.org/auth/github/callback
Content-Type: application/json

{
  "code": "abc123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "developer",
    "display_name": "Developer"
  }
}
```

## Solana Wallet Authentication

Web3 authentication using Solana wallet signatures.

### Step 1: Request Challenge

```bash
POST https://api.solfoundry.org/auth/wallet/challenge
Content-Type: application/json

{
  "wallet_address": "ABC123..."
}
```

Response:
```json
{
  "challenge": "Sign this message to authenticate with SolFoundry: ...",
  "nonce": "abc123"
}
```

### Step 2: Sign Challenge

Sign the challenge message with your wallet.

Using Phantom:
```javascript
const message = "Sign this message to authenticate...";
const encodedMessage = new TextEncoder().encode(message);
const signature = await phantom.signMessage(encodedMessage);
```

### Step 3: Verify Signature

```bash
POST https://api.solfoundry.org/auth/wallet/verify
Content-Type: application/json

{
  "wallet_address": "ABC123...",
  "signature": "base64-encoded-signature",
  "nonce": "abc123"
}
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "wallet_address": "ABC123..."
  }
}
```

## X-User-ID Header (Development Only)

For development and testing, you can use the `X-User-ID` header directly.

> ⚠️ **Warning**: This method is insecure and should only be used in development environments.

```bash
curl -H "X-User-ID: 550e8400-e29b-41d4-a716-446655440000" \
  https://api.solfoundry.org/api/notifications
```

To enable development mode, set the environment variable:

```
AUTH_ENABLED=false
```

## API Key Authentication

For server-to-server communication, use API keys.

### Request Format

```bash
curl -H "X-API-Key: your-api-key" \
  https://api.solfoundry.org/api/notifications
```

### Obtaining an API Key

1. Go to Settings > API Keys in your dashboard
2. Click "Generate New Key"
3. Store the key securely (it's only shown once)

### API Key Scopes

| Scope | Description |
|-------|-------------|
| `bounties:read` | Read bounty information |
| `bounties:write` | Create and update bounties |
| `notifications:read` | Read notifications |
| `notifications:write` | Create notifications |
| `webhooks:write` | Manage webhooks |

## Token Refresh

JWT tokens have a limited lifespan. Refresh them before expiry:

```bash
POST https://api.solfoundry.org/auth/refresh
Authorization: Bearer your-current-token
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

## Logout

Invalidate a token:

```bash
POST https://api.solfoundry.org/auth/logout
Authorization: Bearer your-token
```

## Security Best Practices

1. **Never share tokens** - Keep authentication credentials private
2. **Use HTTPS** - Always use encrypted connections
3. **Store tokens securely** - Use secure storage (httpOnly cookies, secure storage)
4. **Refresh tokens proactively** - Don't wait for expiry
5. **Revoke compromised tokens** - Use logout endpoint immediately
6. **Use appropriate scopes** - Request only needed permissions

## Error Responses

Authentication errors return 401 Unauthorized:

```json
{
  "detail": "Invalid authentication token"
}
```

```json
{
  "detail": "Token has expired"
}
```

```json
{
  "detail": "Missing authentication credentials"
}
```

## Rate Limiting for Auth

Authenticated requests have higher rate limits:

| Endpoint Group | Anonymous | Authenticated |
|----------------|-----------|---------------|
| Bounty Search | 60/min | 100/min |
| Notifications | N/A | 60/min |
| Contributor Profile | 60/min | 100/min |

## Next Steps

- [Bounty API](./bounty-api.md)
- [Notification API](./notification-api.md)
- [WebSocket Events](./websocket-events.md)