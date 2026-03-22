# SolFoundry SDK & CLI Documentation

## Overview

The SolFoundry TypeScript SDK provides a fully-typed client for interacting with the SolFoundry bounty platform. The CLI tool wraps the SDK for command-line usage.

## Installation

```bash
# SDK only
npm install @solfoundry/sdk

# CLI (global)
npm install -g @solfoundry/cli
```

## SDK Reference

### Initialization

```typescript
import { SolFoundryClient } from '@solfoundry/sdk';

const client = new SolFoundryClient({
  apiBaseUrl: 'https://api.solfoundry.io', // optional
});
```

### Bounties

#### `getBounties(params?)`
```typescript
const result = await client.getBounties({
  tier: 'T2',          // optional: 'T1' | 'T2' | 'T3'
  status: 'open',      // optional: 'open' | 'in_progress' | 'completed'
  page: 1,             // optional
  pageSize: 20,        // optional
});
// result: PaginatedResponse<Bounty>
```

#### `getBounty(id)`
```typescript
const bounty = await client.getBounty('bounty-123');
// bounty: Bounty
```

### Contributors

#### `getContributors(params?)`
```typescript
const result = await client.getContributors({ pageSize: 10 });
// result: PaginatedResponse<Contributor>
```

#### `getContributor(address)`
```typescript
const contributor = await client.getContributor('WalletAddress...');
// contributor: Contributor
```

### Submissions

#### `submitWork(bountyId, prUrl, walletAddress)`
```typescript
const submission = await client.submitWork(
  'bounty-123',
  'https://github.com/SolFoundry/solfoundry/pull/999',
  'YourWalletAddress'
);
// submission: WorkSubmission
```

#### `getSubmissions(bountyId)`
```typescript
const submissions = await client.getSubmissions('bounty-123');
// submissions: WorkSubmission[]
```

## CLI Reference

```bash
# List all open T3 bounties
solfoundry bounties list --tier=T3 --status=open

# Get details for a specific bounty
solfoundry bounty get bounty-123

# Submit a PR for a bounty
solfoundry submit bounty-123 https://github.com/SolFoundry/solfoundry/pull/1 MyWalletAddr

# View top contributors
solfoundry contributors
```

## Type Reference

```typescript
interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardToken: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  tier: 'T1' | 'T2' | 'T3';
  complexity: number;
  issueUrl: string;
  createdAt: string;
  updatedAt: string;
  claimedBy?: string;
}

interface Contributor {
  address: string;
  username: string;
  completedBounties: number;
  totalEarned: number;
  reputationScore: number;
  joinedAt: string;
  skills: string[];
}

interface WorkSubmission {
  bountyId: string;
  prUrl: string;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNotes?: string;
}
```
