# Auth Flow — GitHub OAuth and User Management

Complete guide to integrating SolFoundry user authentication into your application.

<!--
  NOTE: The auth flow involves a browser redirect to GitHub, so it is
  typically implemented in a frontend application, not a Node.js script.
  This example shows both the client-side redirect flow and the
  server-side token exchange using the SDK.
-->

## Overview

The SolFoundry SDK provides a complete authentication pipeline via `UsersClient`:

| Method | Description |
|--------|-------------|
| `users.getGitHubAuthorizeUrl()` | Get the GitHub OAuth URL to redirect to |
| `users.exchangeGitHubCode(code)` | Exchange GitHub code for JWT + user profile |
| `users.me()` | Get the current authenticated user's profile |
| `users.refreshTokens(refreshToken)` | Refresh an expired access token |
| `users.logout()` | Revoke the server-side session |

## Flow Diagram

```
User clicks "Sign in"
        │
        ▼
Frontend: sf.users.getGitHubAuthorizeUrl()
        │   → GET /api/auth/github/authorize
        ▼
Redirect to GitHub OAuth page
        │
        ▼
User authorizes SolFoundry on GitHub
        │
        ▼
GitHub redirects to /github/callback?code=XXX&state=YYY
        │
        ▼
Frontend: sf.users.exchangeGitHubCode(code, state)
        │   → POST /api/auth/github { code, state }
        │   ← { access_token, refresh_token, user }
        ▼
sf.setAuthToken(access_token)
        │
        ▼
User is authenticated ✓
```

## Step 1 — Redirect to GitHub

In your frontend, initiate the OAuth flow by fetching the authorize URL and redirecting:

```typescript
import { SolFoundry } from '@solfoundry/sdk';

const sf = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

async function signIn() {
  const url = await sf.users.getGitHubAuthorizeUrl();
  window.location.href = url; // Redirect to GitHub
}
```

## Step 2 — Handle the Callback

After GitHub redirects back, exchange the code for tokens:

```typescript
import { useSearchParams } from 'react-router-dom';
import { SolFoundry } from '@solfoundry/sdk';

const sf = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

function GitHubCallback() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  useEffect(() => {
    if (!code) return;

    sf.users.exchangeGitHubCode(code, state ?? undefined)
      .then((auth) => {
        sf.setAuthToken(auth.access_token);
        // Store refresh token securely
        localStorage.setItem('sf_refresh_token', auth.refresh_token);
        console.log(`Welcome, ${auth.user.username}!`);
        navigate('/');
      })
      .catch((err) => {
        console.error('Auth failed:', err);
        navigate('/sign-in');
      });
  }, [code, state]);

  return <p>Signing you in...</p>;
}
```

## Step 3 — Keep the User Logged In (Token Refresh)

Access tokens expire. When you receive a 401, use the refresh token:

```typescript
import { SolFoundry, AuthenticationError } from '@solfoundry/sdk';

const sf = SolFoundry.create({ baseUrl: 'https://api.solfoundry.io' });

async function ensureAuthenticated() {
  try {
    // Try the API
    const user = await sf.users.me();
    return user;
  } catch (err) {
    if (err instanceof AuthenticationError) {
      // Token expired — refresh
      const refreshToken = localStorage.getItem('sf_refresh_token');
      if (!refreshToken) throw new Error('Not logged in');

      const tokens = await sf.users.refreshTokens(refreshToken);
      sf.setAuthToken(tokens.access_token);
      localStorage.setItem('sf_refresh_token', tokens.refresh_token);

      return await sf.users.me();
    }
    throw err;
  }
}
```

## Step 4 — Logout

```typescript
async function signOut() {
  await sf.users.logout();   // Revoke server session (best-effort)
  sf.setAuthToken(undefined); // Clear local token
  localStorage.removeItem('sf_refresh_token');
  navigate('/');
}
```

## User Profile Fields

After authenticating, the `user` object contains:

```typescript
interface User {
  id: string;              // UUID
  username: string;        // GitHub username
  email: string | null;    // GitHub email (may be null)
  avatar_url: string | null;
  wallet_address: string | null;  // Solana wallet (not linked until verified)
  wallet_verified: boolean;
  github_id: string | null;
  created_at: string | null; // ISO 8601
}
```

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `AuthenticationError` | Invalid/expired token | Refresh or re-authenticate |
| `ValidationError` | Invalid OAuth code | User must try signing in again |
| `RateLimitError` | Too many requests | Wait and retry |
| `NetworkError` | Server unreachable | Retry with backoff |
