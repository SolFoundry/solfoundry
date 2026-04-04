/**
 * Example 12 — Complete Authentication Flow with GitHub OAuth
 *
 * Demonstrates the full user authentication lifecycle using the
 * SolFoundry TypeScript SDK's UsersClient:
 *
 * 1. Initiate GitHub OAuth (get authorize URL)
 * 2. Exchange the OAuth code for JWT tokens
 * 3. Use the access token for authenticated API calls
 * 4. Refresh an expired access token
 * 5. Logout and revoke the session
 *
 * Run: npx ts-node examples/12-auth-flow.ts
 */

import { SolFoundry, SolFoundryError, AuthenticationError } from '../src/index.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const sf = SolFoundry.create({
  baseUrl: 'https://api.solfoundry.io',
  // authToken can be set later via sf.setAuthToken()
});

// ---------------------------------------------------------------------------
// Step 1 — Get the GitHub OAuth authorize URL
//
// Redirect the user to this URL to begin the OAuth flow.
// GitHub will ask the user to authorize the application, then redirect
// back to your registered callback URL with a `code` parameter.
// ---------------------------------------------------------------------------

async function getAuthorizeUrl(): Promise<string> {
  try {
    const url = await sf.users.getGitHubAuthorizeUrl();
    console.log('🔗 Authorize URL:', url);
    return url;
  } catch (err) {
    if (err instanceof SolFoundryError) {
      console.error(`[${err.code}] ${err.message}`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Step 2 — Exchange the OAuth code for JWT tokens
//
// After GitHub redirects back with ?code=..., call this method to
// exchange the code for access + refresh tokens and the user profile.
// ---------------------------------------------------------------------------

async function exchangeCode(code: string): Promise<void> {
  try {
    const auth = await sf.users.exchangeGitHubCode(code);

    console.log('✅ Authentication successful!');
    console.log(`   User: @${auth.user.username} (${auth.user.email})`);
    console.log(`   Access token:  ${auth.access_token.slice(0, 20)}...`);
    console.log(`   Refresh token: ${auth.refresh_token.slice(0, 20)}...`);

    // Store tokens securely (e.g., httpOnly cookie in a web app,
    // or secure storage in a native app)
    sf.setAuthToken(auth.access_token);

    // Store the refresh token for later use
    const refreshToken = auth.refresh_token;

    // Now make authenticated API calls
    await doAuthenticatedCalls();

    // Step 4 — Refresh the access token when it expires
    await refreshAccessToken(refreshToken);

    // Step 5 — Logout
    await logout();
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error('🔐 Authentication failed:', err.message);
    } else {
      console.error('❌ Unexpected error:', err);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Make authenticated API calls
//
// With a valid access token set via setAuthToken(), all API calls
// are automatically authenticated. Only user-specific endpoints
// require authentication.
// ---------------------------------------------------------------------------

async function doAuthenticatedCalls(): Promise<void> {
  // Get the current user's profile
  const me = await sf.users.me();
  console.log(`\n👤 Current user: @${me.username}`);
  console.log(`   Email: ${me.email ?? '(none)'}`);
  console.log(`   Wallet: ${me.wallet_address ?? '(not linked)'}`);
  console.log(`   Wallet verified: ${me.wallet_verified}`);

  // List the user's bounties (if they have any)
  // Note: The API may require additional filtering by creator_id
  // const myBounties = await sf.bounties.list({ creator_id: me.id });
  // console.log(`   Created bounties: ${myBounties.total}`);
}

// ---------------------------------------------------------------------------
// Step 4 — Refresh an expired access token
//
// Access tokens expire. When you receive a 401, use the refresh token
// to get a new access token without re-authenticating the user.
// ---------------------------------------------------------------------------

async function refreshAccessToken(refreshToken: string): Promise<void> {
  try {
    const tokens = await sf.users.refreshTokens(refreshToken);
    console.log('\n🔄 Token refreshed successfully');
    console.log(`   New access token: ${tokens.access_token.slice(0, 20)}...`);

    // Update the SDK with the new token
    sf.setAuthToken(tokens.access_token);
  } catch (err) {
    if (err instanceof AuthenticationError) {
      console.error('🔄 Refresh token expired — user must re-authenticate');
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Logout (revoke session)
// ---------------------------------------------------------------------------

async function logout(): Promise<void> {
  try {
    await sf.users.logout();
    console.log('\n👋 Logged out successfully');
    sf.setAuthToken(undefined);
  } catch (err) {
    // Best-effort — clear local tokens regardless
    sf.setAuthToken(undefined);
    console.warn('⚠️ Server logout failed (cleared local tokens anyway)');
  }
}

// ---------------------------------------------------------------------------
// Usage example (uncomment and provide a real OAuth code to run)
// ---------------------------------------------------------------------------

// const CODE_FROM_GITHUB_CALLBACK = 'your-oauth-code-here';
// await exchangeCode(CODE_FROM_GITHUB_CALLBACK);

console.log('📖 See examples/12-auth-flow.ts for the full authentication flow');
