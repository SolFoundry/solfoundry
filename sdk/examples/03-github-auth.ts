/**
 * SolFoundry SDK Example — GitHub OAuth Authentication Flow.
 *
 * Demonstrates the full GitHub OAuth 2.0 login flow:
 * 1. Get the authorize URL
 * 2. Redirect the user to GitHub
 * 3. Exchange the callback code for JWT tokens
 * 4. Refresh tokens when they expire
 *
 * @example
 * ```bash
 * npx tsx examples/03-github-auth.ts
 * ```
 */

import { SolFoundry } from '../src/index.js';

async function main() {
  const client = SolFoundry.create({
    baseUrl: process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io',
  });

  // Step 1: Get the GitHub authorize URL
  console.log('Fetching GitHub OAuth authorize URL...');
  const authorizeUrl = await client.auth.getGitHubAuthorizeUrl();
  console.log(`Redirect the user to:\n  ${authorizeUrl}\n`);

  // Step 2: User authorizes on GitHub, gets redirected back
  const code = process.env.GITHUB_OAUTH_CODE ?? 'PASTE_CODE_HERE';
  const state = process.env.GITHUB_OAUTH_STATE ?? undefined;

  if (code === 'PASTE_CODE_HERE') {
    console.log('Set GITHUB_OAUTH_CODE env var to continue the flow.');
    return;
  }

  // Step 3: Exchange the code for tokens
  console.log('Exchanging code for tokens...');
  const { access_token, refresh_token, user } = await client.auth.exchangeGitHubCode(code, state);
  console.log(`Logged in as @${user.username} (${user.email ?? 'no email'})`);
  console.log(`Wallet: ${user.wallet_address ?? 'not set'}`);

  // Set the auth token for subsequent requests
  client.setAuthToken(access_token);

  // Step 4: Fetch current user
  const me = await client.auth.getMe();
  console.log(`Current user: @${me.username} (ID: ${me.id})`);

  // Step 5: Refresh tokens
  console.log('Refreshing tokens...');
  const newTokens = await client.auth.refreshTokens(refresh_token);
  console.log(`New access token: ${newTokens.access_token.slice(0, 20)}...`);
  console.log(`Token type: ${newTokens.token_type}`);

  // Step 6: Leaderboard + Stats (no auth required)
  const leaders = await client.leaderboard.getLeaderboard('30d');
  console.log(`\nTop 5 contributors (30d):`);
  leaders.slice(0, 5).forEach(e => console.log(`  #${e.rank} @${e.username}: ${e.earningsFndry} $FNDRY`));

  const stats = await client.leaderboard.getStats();
  console.log(`\nPlatform: ${stats.open_bounties} open bounties, ${stats.total_contributors} contributors, $${stats.total_paid_usdc} paid`);
}

main().catch((err) => {
  console.error('Auth flow failed:', err);
  process.exit(1);
});
