# SolFoundry TypeScript SDK

> **Bounty:** 🏭 Bounty T3: SolFoundry TypeScript SDK  
> **Reward:** 900K $FNDRY  
> **Tier:** T3 (Claim-based — requires 3+ merged T2 bounties)  
> **Domain:** Backend, Docs  

Official TypeScript SDK for programmatic bounty management, submission handling, and user authentication on [SolFoundry](https://solfoundry.dev) — the Autonomous AI Software Factory on Solana.

## Features

- ✅ Full API coverage for bounties, submissions, contributors, and leaderboard
- ✅ TypeScript type definitions with full JSDoc documentation
- ✅ Works in Node.js 18+ and modern browsers
- ✅ ESM + CJS support
- ✅ Comprehensive error handling with `SolFoundryError`
- ✅ Configurable base URL, API key, and timeouts

## Installation

```bash
npm install @solfoundry/sdk
# or
yarn add @solfoundry/sdk
# or
pnpm add @solfoundry/sdk
```

## Quick Start

```typescript
import { SolFoundryClient, BountyStatus, BountyTier } from "@solfoundry/sdk";

const client = new SolFoundryClient({
  baseUrl: "https://api.solfoundry.dev", // default
  apiKey: process.env.SOLFOUNDRY_API_KEY,
});

// List all open T2 bounties
const { items: bounties, total } = await client.listBounties({
  status: BountyStatus.OPEN,
  tier: BountyTier.T2,
  limit: 20,
});

console.log(`Found ${total} open T2 bounties`);
for (const bounty of bounties) {
  console.log(`  #${bounty.id} [T${bounty.tier}] ${bounty.title} — ${bounty.reward} FNDRY`);
}

// Submit a PR
const submission = await client.submitSolution(bounty.id, {
  pr_url: "https://github.com/you/pr/pull/1",
  submitted_by: "your-github-username",
  notes: "Implements all acceptance criteria with tests",
});
console.log("Submission ID:", submission.id);
```

## API Reference

### SolFoundryClient

Main client for all API operations.

```typescript
const client = new SolFoundryClient({
  baseUrl: "https://api.solfoundry.dev",
  apiKey: "your-api-key",
  timeout: 30_000, // ms, default 30s
});
```

#### Bounty Operations

```typescript
// List bounties with filters
const list = await client.listBounties({
  status: BountyStatus.OPEN,
  tier: BountyTier.T2,
  skills: ["typescript", "react"],
  skip: 0,
  limit: 20,
});

// Get single bounty
const bounty = await client.getBounty("bounty-id-123");

// Create bounty (authenticated)
const newBounty = await client.createBounty({
  title: "Fix login bug",
  description: "Users cannot login with Google OAuth",
  tier: BountyTier.T1,
  reward: 500,
  skills: ["typescript", "node"],
});

// Update bounty (authenticated)
const updated = await client.updateBounty("bounty-id-123", {
  status: BountyStatus.IN_PROGRESS,
  reward: 750,
});

// Delete bounty (authenticated)
await client.deleteBounty("bounty-id-123");

// Submit PR solution
const submission = await client.submitSolution("bounty-id-123", {
  pr_url: "https://github.com/you/repo/pull/42",
  submitted_by: "your-github-username",
  notes: "Fixes all acceptance criteria",
});

// List submissions for a bounty
const submissions = await client.getSubmissions("bounty-id-123");
```

#### Contributor Operations

```typescript
const contributor = await client.getContributor("octocat");
console.log(`@${contributor.github_username} — Level ${contributor.level} — ${contributor.xp} XP`);
```

#### Leaderboard

```typescript
const weekly = await client.getLeaderboard("weekly", 10);
weekly.forEach((entry) => {
  console.log(`#${entry.rank} @${entry.contributor.github_username}`);
});
```

#### Notifications

```typescript
const notifications = await client.listNotifications();
const unread = await client.listNotifications(unreadOnly: true);
await client.markNotificationRead("notification-id");
```

#### Payouts

```typescript
const payouts = await client.getPayouts();
const myPayouts = await client.getPayouts("contributor-id");
```

#### Health Check

```typescript
const { status } = await client.health();
console.log("API status:", status);
```

### BountyService

High-level helpers built on top of the client.

```typescript
import { BountyService } from "@solfoundry/sdk";

const bountyService = new BountyService(client);

// Find best bounties for your skills
const myBounties = await bountyService.findBountiesBySkills(
  ["typescript", "react", "node"],
  BountyTier.T2
);

// Get top-paying open bounties
const topBounties = await bountyService.getTopBounties(10);

// Submit a PR
await bountyService.submitPR(
  "bounty-id",
  "https://github.com/you/pr/pull/1",
  "your-github",
  "Full implementation with tests"
);
```

## Error Handling

```typescript
import { SolFoundryClient, SolFoundryError } from "@solfoundry/sdk";

try {
  const bounty = await client.getBounty("nonexistent");
} catch (err) {
  if (err instanceof SolFoundryError) {
    console.error(`HTTP ${err.statusCode}: ${err.message}`);
    if (err.response) {
      console.error("Details:", err.response);
    }
  }
}
```

## Type Definitions

All types mirror the backend Pydantic models:

- `BountyTier` — `T1 | T2 | T3`
- `BountyStatus` — `OPEN | IN_PROGRESS | COMPLETED | PAID`
- `BountyResponse` — Full bounty object
- `SubmissionResponse` — Submission with timestamps
- `ContributorResponse` — User profile with XP and level
- `LeaderboardEntry` — Ranked contributor
- `NotificationResponse` — User notification
- `PayoutResponse` — Payout record with tx hash

## Payment

**Address:** EVM `0x6FCBd5d14FB296933A4f5a515933B153bA24370E`

For questions about this SDK, open an issue on the [SolFoundry repository](https://github.com/SolFoundry/solfoundry).
