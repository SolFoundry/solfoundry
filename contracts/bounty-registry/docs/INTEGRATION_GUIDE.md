# Bounty Registry — Integration Guide

How to integrate with the SolFoundry on-chain bounty registry from your application, indexer, or script.

## Prerequisites

- Node.js 18+
- `@coral-xyz/anchor` >= 0.30.1
- `@solana/web3.js` >= 1.95.0
- A Solana RPC endpoint (mainnet, devnet, or local validator)

## Installation

```bash
cd contracts/bounty-registry
npm install
```

## Quick Start

### Using the TypeScript SDK

```typescript
import { BountyRegistryClient, BountyStatus, deriveBountyPda } from "./sdk/src";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

// Set up the provider and program.
const connection = new Connection("https://api.devnet.solana.com");
const provider = AnchorProvider.env();
const program = new Program(idl, provider);

const client = new BountyRegistryClient(provider, program);
```

### Registering a Bounty

```typescript
const txSig = await client.registerBounty(
  600,                                          // bountyId
  "On-chain Bounty Registry Program",           // title
  3,                                            // tier
  1_000_000,                                    // rewardAmount (metadata only)
  "https://github.com/SolFoundry/solfoundry/issues/600"  // githubIssue
);
console.log("Registered bounty. Tx:", txSig);
```

### Claiming a Bounty

```typescript
const contributorPubkey = new PublicKey("...");
const txSig = await client.updateStatus(
  600,
  BountyStatus.Claimed,
  contributorPubkey
);
```

### Moving to Review

```typescript
await client.updateStatus(600, BountyStatus.InReview);
```

### Recording Completion

```typescript
import { createHash } from "crypto";

const prDiff = "...full PR diff text...";
const prHash = Array.from(createHash("sha256").update(prDiff).digest());

await client.recordCompletion(
  600,
  "https://github.com/SolFoundry/solfoundry/pull/600",
  [850, 900, 870, 880, 890],  // 5 model scores (0-1000)
  878,                          // final aggregated score
  prHash                        // SHA-256 hash of PR diff
);
```

### Cancelling a Bounty

```typescript
await client.closeBounty(600);
```

## Querying Records

### Fetch by Bounty ID

```typescript
const record = await client.fetchBounty(600);
if (record) {
  console.log("Title:", record.title);
  console.log("Status:", Object.keys(record.status)[0]);
  console.log("Tier:", record.tier);
  console.log("Reward:", record.rewardAmount.toString());
}
```

### List by Contributor

```typescript
const bounties = await client.listByContributor(contributorPubkey);
for (const { address, data } of bounties) {
  console.log(`Bounty ${data.bountyId}: ${data.title} @ ${address.toBase58()}`);
}
```

### List by Status

```typescript
const openBounties = await client.listByStatus(BountyStatus.Open);
console.log(`${openBounties.length} open bounties`);
```

### List All with Filters

```typescript
const filtered = await client.listBounties({
  tier: 3,
  status: BountyStatus.Completed,
});
```

## PDA Derivation

Derive the on-chain address for any bounty without fetching:

```typescript
import { deriveBountyPda } from "./sdk/src";

const [pda, bump] = deriveBountyPda(600);
console.log("Bounty 600 PDA:", pda.toBase58());
```

Seeds: `["registry", bounty_id.to_le_bytes()]` where `bounty_id` is a `u64` in little-endian.

## Event Consumption

The program emits four event types for off-chain indexer consumption:

| Event              | When                      | Key Fields                        |
|--------------------|---------------------------|-----------------------------------|
| BountyRegistered   | New bounty created        | bounty_id, title, tier, creator   |
| BountyStatusUpdated| Status transition         | bounty_id, previous/new status    |
| BountyCompleted    | Review recorded, completed| bounty_id, scores, pr_hash        |
| BountyClosed       | Bounty cancelled          | bounty_id, previous_status        |

### Example: Listening with Anchor Events

```typescript
const listener = program.addEventListener("BountyRegistered", (event) => {
  console.log(`New bounty ${event.bountyId}: ${event.title}`);
});

// Later, remove the listener.
program.removeEventListener(listener);
```

## Authority Model

- **Single admin signer**: The wallet that registers a bounty becomes its authority.
- **Authority check**: All mutation instructions verify `bounty_record.creator == admin.key()`.
- **Upgradeable to multisig**: The admin field is a `Pubkey`, so a multisig PDA can be used as the authority without program changes.

## Error Handling

All custom errors return an `AnchorError` with a descriptive `errorCode.code`:

```typescript
try {
  await client.registerBounty(600, "x".repeat(100), 1, 0, "issue");
} catch (error) {
  if (error instanceof AnchorError) {
    console.log("Error code:", error.error.errorCode.code);  // "TitleTooLong"
    console.log("Message:", error.error.errorMessage);
  }
}
```

See [SCHEMA_REFERENCE.md](./SCHEMA_REFERENCE.md) for the full error code table.

## Running Tests

```bash
# Build the program
anchor build

# Run the test suite (>95% coverage)
anchor test
```

Tests cover all four instructions, the full state machine, authority checks, input validation, error paths, PDA derivation, edge cases, and query functionality.

## Deployment

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet
anchor deploy --provider.cluster mainnet
```

After deployment, commit the generated IDL (`target/idl/bounty_registry.json`) to the repository for client consumption.
