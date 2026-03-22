# @solfoundry/sdk

TypeScript SDK for interacting with the SolFoundry bounty platform.

## Install

```bash
npm install @solfoundry/sdk
```

## Quick Start

```typescript
import { SolFoundryClient } from '@solfoundry/sdk';

const client = new SolFoundryClient();

// List open bounties
const bounties = await client.getBounties({ status: 'open', tier: 'T2' });
console.log(bounties.data);

// Get a specific bounty
const bounty = await client.getBounty('bounty-id');

// Submit work
const submission = await client.submitWork('bounty-id', 'https://github.com/.../pull/1', 'YourWalletAddress');
```

## API Reference

### `new SolFoundryClient(config?)`
- `config.apiBaseUrl` — Override API base URL (default: `https://api.solfoundry.io`)

### Methods

| Method | Description |
|--------|-------------|
| `getBounties(params?)` | List bounties with optional tier/status/pagination filters |
| `getBounty(id)` | Get a single bounty by ID |
| `getContributors(params?)` | List contributors leaderboard |
| `getContributor(address)` | Get contributor by wallet address |
| `submitWork(bountyId, prUrl, wallet)` | Submit a PR for a bounty |
| `getSubmissions(bountyId)` | Get all submissions for a bounty |
| `getContributorSubmissions(address)` | Get all submissions by a contributor |

## Types

```typescript
interface Bounty {
  id: string;
  title: string;
  reward: number;
  rewardToken: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  tier: 'T1' | 'T2' | 'T3';
  issueUrl: string;
}

interface Contributor {
  address: string;
  username: string;
  completedBounties: number;
  totalEarned: number;
  reputationScore: number;
}

interface WorkSubmission {
  bountyId: string;
  prUrl: string;
  submittedBy: string;
  status: 'pending' | 'approved' | 'rejected';
}
```

## License

MIT
