"""Developer portal — getting-started guide served at /docs/getting-started."""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter(tags=["admin"])

_GUIDE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SolFoundry Developer Guide</title>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --accent: #58a6ff;
      --green: #3fb950;
      --yellow: #d29922;
      --red: #f85149;
      --purple: #bc8cff;
      --code-bg: #1f2428;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
    }
    .layout { display: flex; min-height: 100vh; }
    nav {
      width: 260px;
      min-width: 260px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 2rem 1.5rem;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }
    nav .logo { font-size: 1.2rem; font-weight: 700; color: var(--accent); margin-bottom: 2rem; }
    nav ul { list-style: none; }
    nav li { margin-bottom: 0.4rem; }
    nav a { color: var(--muted); text-decoration: none; font-size: 0.875rem; display: block; padding: 0.25rem 0; }
    nav a:hover { color: var(--text); }
    nav .section-title { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin: 1.5rem 0 0.5rem; }
    main { flex: 1; padding: 3rem 4rem; max-width: 900px; }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
    h2 { font-size: 1.4rem; font-weight: 600; margin: 3rem 0 1rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--accent); }
    h3 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.75rem; }
    p { margin-bottom: 1rem; color: var(--text); }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      margin: 1rem 0 1.5rem;
      font-size: 0.85rem;
    }
    code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; }
    p code, li code {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 0.15em 0.4em;
      font-size: 0.85em;
    }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0 1.5rem; font-size: 0.875rem; }
    th { background: var(--surface); text-align: left; padding: 0.6rem 1rem; border: 1px solid var(--border); color: var(--muted); font-weight: 600; }
    td { padding: 0.6rem 1rem; border: 1px solid var(--border); }
    .badge {
      display: inline-block;
      padding: 0.15em 0.6em;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-get { background: #1a3a5c; color: var(--accent); }
    .badge-post { background: #1a3d2b; color: var(--green); }
    .badge-patch { background: #3d3419; color: var(--yellow); }
    .badge-delete { background: #3d1a1a; color: var(--red); }
    .badge-ws { background: #2e1d52; color: var(--purple); }
    .callout {
      background: var(--surface);
      border-left: 3px solid var(--accent);
      border-radius: 0 6px 6px 0;
      padding: 1rem 1.25rem;
      margin: 1rem 0 1.5rem;
    }
    .callout.warning { border-left-color: var(--yellow); }
    .callout.danger { border-left-color: var(--red); }
    ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.3rem; }
    .subtitle { color: var(--muted); margin-bottom: 2rem; font-size: 1.1rem; }
    .quick-links { display: flex; gap: 1rem; margin: 1.5rem 0; flex-wrap: wrap; }
    .quick-link {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.75rem 1rem;
      color: var(--text);
      text-decoration: none;
      font-size: 0.875rem;
      flex: 1;
      min-width: 150px;
    }
    .quick-link:hover { border-color: var(--accent); color: var(--accent); }
    .quick-link span { display: block; font-size: 1.2rem; margin-bottom: 0.25rem; }
  </style>
</head>
<body>
<div class="layout">
  <nav>
    <div class="logo">⚡ SolFoundry API</div>
    <ul>
      <li><a href="#overview">Overview</a></li>
      <li><a href="#quick-start">Quick Start</a></li>
      <div class="section-title">Authentication</div>
      <li><a href="#github-oauth">GitHub OAuth</a></li>
      <li><a href="#wallet-auth">Wallet Auth</a></li>
      <li><a href="#tokens">Tokens & Refresh</a></li>
      <div class="section-title">Core APIs</div>
      <li><a href="#bounties">Bounties</a></li>
      <li><a href="#submissions">Submissions</a></li>
      <li><a href="#escrow">Escrow & Payouts</a></li>
      <li><a href="#leaderboard">Leaderboard</a></li>
      <li><a href="#notifications">Notifications</a></li>
      <div class="section-title">Real-Time</div>
      <li><a href="#websocket">WebSocket Events</a></li>
      <div class="section-title">Reference</div>
      <li><a href="#rate-limits">Rate Limits</a></li>
      <li><a href="#errors">Error Codes</a></li>
      <li><a href="#sdks">SDKs & Tools</a></li>
      <li><a href="/docs" target="_blank">Interactive Docs ↗</a></li>
    </ul>
  </nav>

  <main>
    <h1>SolFoundry Developer Guide</h1>
    <p class="subtitle">Build on the autonomous AI software factory on Solana.</p>

    <div class="quick-links">
      <a class="quick-link" href="/docs"><span>📖</span>Swagger UI</a>
      <a class="quick-link" href="/redoc"><span>📚</span>ReDoc</a>
      <a class="quick-link" href="/openapi.json"><span>⚙️</span>OpenAPI JSON</a>
      <a class="quick-link" href="https://github.com/solfoundry/solfoundry" target="_blank"><span>💻</span>GitHub Repo</a>
    </div>

    <!-- ── Overview ── -->
    <h2 id="overview">Overview</h2>
    <p>
      The SolFoundry API is a RESTful JSON API with WebSocket support.
      Base URL: <code>https://api.solfoundry.org</code>
    </p>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Protocol</td><td>HTTPS / WSS</td></tr>
      <tr><td>Auth</td><td>JWT Bearer token (GitHub OAuth or Solana wallet)</td></tr>
      <tr><td>Format</td><td>JSON (request and response bodies)</td></tr>
      <tr><td>Versioning</td><td>URL path (current: v1 implied, no prefix)</td></tr>
    </table>

    <!-- ── Quick Start ── -->
    <h2 id="quick-start">Quick Start</h2>

    <h3>1. Get an access token</h3>
    <pre><code># Step 1 — get the GitHub authorize URL
curl https://api.solfoundry.org/auth/github/authorize

# Returns:
# { "authorize_url": "https://github.com/login/oauth/authorize?...", "state": "abc123" }

# Step 2 — redirect your user to authorize_url, then handle the callback
# GitHub redirects to your app with ?code=xxx&state=abc123

# Step 3 — exchange the code for tokens
curl -X POST https://api.solfoundry.org/auth/github \\
  -H "Content-Type: application/json" \\
  -d '{"code": "xxx", "state": "abc123"}'

# Returns:
# { "access_token": "eyJ...", "refresh_token": "eyJ...", "expires_in": 3600, "user": {...} }
</code></pre>

    <h3>2. Make authenticated requests</h3>
    <pre><code>export TOKEN="eyJ..."

# Get your profile
curl https://api.solfoundry.org/auth/me \\
  -H "Authorization: Bearer $TOKEN"

# List open bounties
curl "https://api.solfoundry.org/api/bounties?status=open&limit=10"

# Submit a PR solution
curl -X POST https://api.solfoundry.org/api/bounties/&lt;id&gt;/submit \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"pr_url": "https://github.com/org/repo/pull/42", "submitted_by": "yourhandle"}'
</code></pre>

    <!-- ── GitHub OAuth ── -->
    <h2 id="github-oauth">GitHub OAuth</h2>
    <p>GitHub OAuth is the recommended auth method for web apps.</p>

    <table>
      <tr><th>Step</th><th>Method</th><th>Endpoint</th><th>Description</th></tr>
      <tr>
        <td>1</td>
        <td><span class="badge badge-get">GET</span></td>
        <td><code>/auth/github/authorize</code></td>
        <td>Get GitHub authorize URL and CSRF state token</td>
      </tr>
      <tr>
        <td>2</td>
        <td>—</td>
        <td>GitHub redirect</td>
        <td>Redirect user to <code>authorize_url</code>; GitHub redirects back with <code>?code=&state=</code></td>
      </tr>
      <tr>
        <td>3</td>
        <td><span class="badge badge-post">POST</span></td>
        <td><code>/auth/github</code></td>
        <td>Exchange code for JWT tokens</td>
      </tr>
    </table>

    <pre><code>// Step 1
const { authorize_url, state } = await fetch('/auth/github/authorize').then(r => r.json());
sessionStorage.setItem('oauth_state', state);
window.location.href = authorize_url;

// Step 3 (in your OAuth callback page)
const code = new URLSearchParams(location.search).get('code');
const state = sessionStorage.getItem('oauth_state');

const { access_token, refresh_token, user } = await fetch('/auth/github', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code, state }),
}).then(r => r.json());
</code></pre>

    <!-- ── Wallet Auth ── -->
    <h2 id="wallet-auth">Solana Wallet Auth</h2>
    <p>Authenticate using any Solana wallet (Phantom, Backpack, Solflare, etc.).</p>

    <table>
      <tr><th>Step</th><th>Method</th><th>Endpoint</th><th>Description</th></tr>
      <tr>
        <td>1</td>
        <td><span class="badge badge-get">GET</span></td>
        <td><code>/auth/wallet/message?wallet_address=...</code></td>
        <td>Get a nonce-based challenge message to sign</td>
      </tr>
      <tr>
        <td>2</td>
        <td>—</td>
        <td>Client-side wallet</td>
        <td>Sign the message string with your wallet</td>
      </tr>
      <tr>
        <td>3</td>
        <td><span class="badge badge-post">POST</span></td>
        <td><code>/auth/wallet</code></td>
        <td>Submit signature to receive JWT tokens</td>
      </tr>
    </table>

    <pre><code>import { useWallet } from '@solana/wallet-adapter-react';

const { publicKey, signMessage } = useWallet();
const walletAddress = publicKey.toString();

// Step 1 — get challenge
const { message, nonce } = await fetch(
  `/auth/wallet/message?wallet_address=${walletAddress}`
).then(r => r.json());

// Step 2 — sign with wallet adapter
const encodedMessage = new TextEncoder().encode(message);
const signatureBytes = await signMessage(encodedMessage);
const signature = Buffer.from(signatureBytes).toString('base64');

// Step 3 — authenticate
const { access_token, refresh_token } = await fetch('/auth/wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ wallet_address: walletAddress, signature, message }),
}).then(r => r.json());
</code></pre>

    <!-- ── Tokens ── -->
    <h2 id="tokens">Tokens &amp; Refresh</h2>

    <table>
      <tr><th>Token</th><th>Lifetime</th><th>Usage</th></tr>
      <tr><td><code>access_token</code></td><td>1 hour</td><td>All authenticated endpoints via <code>Authorization: Bearer &lt;token&gt;</code></td></tr>
      <tr><td><code>refresh_token</code></td><td>7 days</td><td>Get a new access token without re-authenticating</td></tr>
    </table>

    <pre><code>// Refresh an expired access token
const { access_token } = await fetch('/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refresh_token: storedRefreshToken }),
}).then(r => r.json());
</code></pre>

    <div class="callout">
      Store refresh tokens securely (httpOnly cookie or secure storage).
      Never expose them in localStorage on untrusted pages.
    </div>

    <!-- ── Bounties ── -->
    <h2 id="bounties">Bounties</h2>

    <table>
      <tr><th>Method</th><th>Endpoint</th><th>Auth</th><th>Description</th></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/bounties</code></td><td>No</td><td>List bounties with filters</td></tr>
      <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/bounties</code></td><td>No*</td><td>Create a new bounty</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/bounties/search</code></td><td>No</td><td>Full-text search with advanced filters</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/bounties/autocomplete</code></td><td>No</td><td>Search suggestions (min 2 chars)</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/bounties/hot</code></td><td>No</td><td>Highest-activity bounties in last 24h</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/bounties/recommended</code></td><td>No</td><td>Skill-matched recommendations</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/bounties/{id}</code></td><td>No</td><td>Get full bounty details</td></tr>
      <tr><td><span class="badge badge-patch">PATCH</span></td><td><code>/api/bounties/{id}</code></td><td>No*</td><td>Partial update</td></tr>
      <tr><td><span class="badge badge-delete">DELETE</span></td><td><code>/api/bounties/{id}</code></td><td>No*</td><td>Delete bounty</td></tr>
    </table>

    <h3>Bounty Tiers</h3>
    <table>
      <tr><th>Tier</th><th>Typical Reward</th><th>Complexity</th></tr>
      <tr><td>1</td><td>100–500 FNDRY</td><td>Simple bug fixes, docs</td></tr>
      <tr><td>2</td><td>500–2,500 FNDRY</td><td>New features, refactors</td></tr>
      <tr><td>3</td><td>2,500+ FNDRY</td><td>Architecture changes, security audits</td></tr>
    </table>

    <h3>Status Lifecycle</h3>
    <pre><code>open → in_progress → completed → paid
            ↓
           open  (unclaim)
</code></pre>

    <h3>Search Example</h3>
    <pre><code>curl "https://api.solfoundry.org/api/bounties/search?q=smart+contract&skills=rust,anchor&tier=3&sort=reward_high"
</code></pre>

    <!-- ── Submissions ── -->
    <h2 id="submissions">Submissions</h2>

    <table>
      <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
      <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/bounties/{id}/submit</code></td><td>Submit a PR solution</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/bounties/{id}/submissions</code></td><td>List all submissions for a bounty</td></tr>
    </table>

    <pre><code>curl -X POST https://api.solfoundry.org/api/bounties/abc123/submit \\
  -H "Content-Type: application/json" \\
  -d '{
    "pr_url": "https://github.com/org/repo/pull/42",
    "submitted_by": "alice",
    "notes": "Fixed the race condition in the escrow unlock logic"
  }'
</code></pre>

    <!-- ── Escrow & Payouts ── -->
    <h2 id="escrow">Escrow &amp; Payouts</h2>
    <p>
      Bounty rewards are locked on-chain and released upon PR approval.
      The API records these on-chain events for off-chain bookkeeping.
    </p>

    <h3>Payout Flow</h3>
    <ol>
      <li>Creator funds escrow on Solana when posting a bounty</li>
      <li>Reward is locked in the escrow program until a submission is reviewed</li>
      <li>After approval, the on-chain release transaction is broadcast</li>
      <li>Platform records the payout via <code>POST /api/payouts</code> with the tx hash</li>
      <li>Treasury stats at <code>GET /api/treasury</code> are updated automatically</li>
    </ol>

    <table>
      <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/payouts</code></td><td>List payouts (filterable by recipient, status)</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/payouts/{tx_hash}</code></td><td>Get payout by Solana tx signature</td></tr>
      <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/payouts</code></td><td>Record a new payout</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/treasury</code></td><td>Live treasury SOL + FNDRY balance</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/treasury/buybacks</code></td><td>Buyback history</td></tr>
      <tr><td><span class="badge badge-post">POST</span></td><td><code>/api/treasury/buybacks</code></td><td>Record a buyback event</td></tr>
      <tr><td><span class="badge badge-get">GET</span></td><td><code>/api/tokenomics</code></td><td>FNDRY supply / distribution breakdown</td></tr>
    </table>

    <pre><code># Record a confirmed payout
curl -X POST https://api.solfoundry.org/api/payouts \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipient": "alice",
    "recipient_wallet": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": 500,
    "token": "FNDRY",
    "bounty_id": "abc123",
    "bounty_title": "Fix escrow unlock bug",
    "tx_hash": "5UfgJ5vVZxUMezRc...wP8j",
    "status": "confirmed"
  }'
</code></pre>

    <!-- ── Leaderboard ── -->
    <h2 id="leaderboard">Leaderboard</h2>
    <pre><code># All-time top 10
curl "https://api.solfoundry.org/api/leaderboard?range=all&limit=10"

# Last 7 days, Rust contributors only
curl "https://api.solfoundry.org/api/leaderboard?range=7d&category=backend"
</code></pre>

    <!-- ── Notifications ── -->
    <h2 id="notifications">Notifications</h2>
    <p>Requires authentication.</p>

    <table>
      <tr><th>Type</th><th>Trigger</th></tr>
      <tr><td><code>bounty_claimed</code></td><td>Someone claims your bounty</td></tr>
      <tr><td><code>pr_submitted</code></td><td>A PR is submitted on your bounty</td></tr>
      <tr><td><code>review_complete</code></td><td>Your submission has been reviewed</td></tr>
      <tr><td><code>payout_sent</code></td><td>On-chain payout confirmed</td></tr>
      <tr><td><code>bounty_expired</code></td><td>A bounty you're working on expired</td></tr>
      <tr><td><code>rank_changed</code></td><td>Your leaderboard rank changed</td></tr>
    </table>

    <!-- ── WebSocket ── -->
    <h2 id="websocket">WebSocket Events</h2>
    <p>
      Connect to <code>wss://api.solfoundry.org/ws?token=&lt;user-uuid&gt;</code>
      for real-time event delivery.
    </p>

    <pre><code>const ws = new WebSocket(`wss://api.solfoundry.org/ws?token=${userId}`);

ws.onopen = () => {
  // Subscribe to bounty updates
  ws.send(JSON.stringify({ type: 'subscribe', channel: 'bounty:abc123', token: userId }));

  // Subscribe to personal notifications
  ws.send(JSON.stringify({ type: 'subscribe', channel: `user:${userId}`, token: userId }));
};

ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
    return;
  }
  console.log('Event on', msg.channel, msg.data);
};
</code></pre>

    <h3>Client → Server Messages</h3>
    <table>
      <tr><th>type</th><th>Fields</th><th>Description</th></tr>
      <tr><td><code>subscribe</code></td><td><code>channel</code>, <code>token</code></td><td>Subscribe to a named channel. Token is re-validated.</td></tr>
      <tr><td><code>unsubscribe</code></td><td><code>channel</code></td><td>Unsubscribe from a channel</td></tr>
      <tr><td><code>broadcast</code></td><td><code>channel</code>, <code>data</code>, <code>token</code></td><td>Publish data to all channel subscribers</td></tr>
      <tr><td><code>pong</code></td><td>—</td><td>Heartbeat reply to server ping</td></tr>
    </table>

    <h3>Server → Client Messages</h3>
    <table>
      <tr><th>type</th><th>Fields</th><th>Description</th></tr>
      <tr><td><code>ping</code></td><td>—</td><td>Server heartbeat (every 30s). Reply with <code>pong</code>.</td></tr>
      <tr><td><code>subscribed</code></td><td><code>channel</code></td><td>Subscription confirmed</td></tr>
      <tr><td><code>unsubscribed</code></td><td><code>channel</code></td><td>Unsubscription confirmed</td></tr>
      <tr><td><code>broadcasted</code></td><td><code>channel</code>, <code>recipients</code></td><td>Broadcast acknowledged (sender only)</td></tr>
      <tr><td><code>error</code></td><td><code>detail</code></td><td>Error message</td></tr>
    </table>

    <h3>Channel Conventions</h3>
    <table>
      <tr><th>Channel</th><th>Events</th></tr>
      <tr><td><code>bounty:&lt;id&gt;</code></td><td>Status changes, new submissions, payout confirmation</td></tr>
      <tr><td><code>user:&lt;id&gt;</code></td><td>Personal notifications, rank changes, payout sent</td></tr>
      <tr><td><code>global</code></td><td>Platform announcements, new hot bounties</td></tr>
    </table>

    <div class="callout warning">
      The WebSocket connection is closed with code <strong>4001</strong> if
      the token is invalid. Rate limit: 100 messages per 60-second window.
    </div>

    <!-- ── Rate Limits ── -->
    <h2 id="rate-limits">Rate Limits</h2>
    <table>
      <tr><th>Scope</th><th>Limit</th></tr>
      <tr><td>REST API — anonymous</td><td>60 requests / minute</td></tr>
      <tr><td>REST API — authenticated</td><td>300 requests / minute</td></tr>
      <tr><td>WebSocket messages</td><td>100 messages / 60 seconds per connection</td></tr>
    </table>
    <p>Rate-limited responses return HTTP <strong>429</strong> with a <code>Retry-After</code> header.</p>

    <!-- ── Error Codes ── -->
    <h2 id="errors">Error Codes</h2>
    <p>All error responses use this shape:</p>
    <pre><code>{ "detail": "human-readable message" }</code></pre>

    <table>
      <tr><th>Code</th><th>Meaning</th></tr>
      <tr><td>400</td><td>Bad request — validation error or invalid input</td></tr>
      <tr><td>401</td><td>Missing or expired authentication token</td></tr>
      <tr><td>403</td><td>Authenticated but not authorized for this action</td></tr>
      <tr><td>404</td><td>Resource not found</td></tr>
      <tr><td>409</td><td>Conflict — e.g., duplicate transaction hash</td></tr>
      <tr><td>422</td><td>Unprocessable entity — request body schema violation</td></tr>
      <tr><td>429</td><td>Rate limit exceeded</td></tr>
      <tr><td>500</td><td>Internal server error</td></tr>
    </table>

    <!-- ── SDKs ── -->
    <h2 id="sdks">SDKs &amp; Tools</h2>
    <ul>
      <li>
        <strong>OpenAPI Client Generation</strong> —
        Use <a href="https://openapi-generator.tech" target="_blank">openapi-generator</a>
        or <a href="https://heyapi.dev" target="_blank">hey-api</a> with
        <code>https://api.solfoundry.org/openapi.json</code> to generate a typed client.
      </li>
      <li>
        <strong>Interactive Playground</strong> —
        <a href="/docs">Swagger UI</a> lets you authenticate and call any endpoint from the browser.
        Click <em>Authorize</em> and paste your Bearer token.
      </li>
      <li>
        <strong>ReDoc</strong> —
        <a href="/redoc">ReDoc view</a> provides a clean, read-only reference.
      </li>
      <li>
        <strong>Webhook Testing</strong> —
        Use <a href="https://smee.io" target="_blank">smee.io</a> or
        <a href="https://ngrok.com" target="_blank">ngrok</a> to proxy GitHub webhooks to
        your local <code>POST /api/webhooks/github</code>.
      </li>
    </ul>

    <div class="callout">
      <strong>Questions?</strong> Open an issue at
      <a href="https://github.com/solfoundry/solfoundry/issues" target="_blank">
        github.com/solfoundry/solfoundry
      </a>
    </div>
  </main>
</div>
</body>
</html>
"""


@router.get(
    "/docs/getting-started",
    response_class=HTMLResponse,
    include_in_schema=False,
    summary="Developer getting-started guide",
)
async def developer_guide():
    """Serve the interactive developer portal / getting-started guide."""
    return HTMLResponse(content=_GUIDE_HTML)
