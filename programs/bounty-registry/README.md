# SolFoundry — On-chain Bounty Registry Program

> Anchor smart contract (Solana) implementing the core on-chain bounty registry — storing bounty state, escrowing rewards, tracking contributors, and enforcing tier-based reputation.

## Overview

The Bounty Registry Program is the source of truth for all SolFoundry bounty data on-chain. It manages:

- **Bounties** — created with escrowed rewards, tracked through their full lifecycle
- **Contributors** — registered with tier, reputation, and earnings history
- **Rewards** — locked in PDA escrow at creation, released atomically on completion
- **Slashing** — penalising bad actors, with auto-ban after 3 slashes

## Instructions

### `initialize_registry`
One-time setup of the registry PDA. Only the admin keypair can call this.

```typescript
await program.methods
  .initializeRegistry()
  .accounts({ registry, rewardMint, admin, systemProgram })
  .rpc();
```

### `register_bounty`
Create a new bounty on-chain. Transfers reward tokens from creator into a PDA escrow.

```typescript
await program.methods
  .registerBounty(issueNumber, reward, tier, Buffer.from(prUrl))
  .accounts({ registry, bounty, escrow, rewardMint, creatorTokenAccount, creator, tokenProgram, systemProgram })
  .signers([creator])
  .rpc();
```

### `complete_bounty`
Approve a completed bounty. Requires admin co-signature. Releases escrowed reward to contributor.

```typescript
await program.methods
  .completeBounty(issueNumber)
  .accounts({ registry, bounty, escrow, contributor, contributorTokenAccount, rewardMint, contributorAuthority, tokenProgram, admin })
  .signers([contributor])
  .rpc();
```

### `cancel_bounty`
Cancel a bounty (Open or Claimed) and refund the escrow. Admin only.

```typescript
await program.methods
  .cancelBounty(issueNumber, 'reason')
  .accounts({ registry, bounty, escrow, creatorTokenAccount, rewardMint, admin, tokenProgram })
  .rpc();
```

### `register_contributor`
Self-registration of a new contributor with GitHub handle and tier.

```typescript
await program.methods
  .registerContributor('alice', 2)
  .accounts({ registry, contributor, authority, systemProgram })
  .signers([authority])
  .rpc();
```

### `slash_contributor`
Admin-only penalty instruction. Reduces reputation. Auto-bans after 3 slashes.

```typescript
await program.methods
  .slashContributor(new BN(10000), 'reason')
  .accounts({ registry, contributor, contributorAuthority, admin })
  .rpc();
```

## Account Structures

### `Registry`
```rust
pub admin: Pubkey,
pub reward_mint: Pubkey,
pub total_bounties: u64,
pub total_completed: u64,
pub total_reward_paid: u64,
```

### `BountyAccount`
```rust
pub issue_number: u32,
pub reward: u64,
pub tier: u8,              // 1, 2, or 3
pub status: BountyStatus,  // Open | Claimed | UnderReview | Completed | Cancelled | Disputed
pub creator: Pubkey,
pub contributor: Option<Pubkey>,
pub created_at: i64,
pub completed_at: Option<i64>,
```

### `ContributorAccount`
```rust
pub github_handle: [u8; 64],
pub tier: u8,
pub status: ContributorStatus,  // Active | Slashed | Banned
pub reputation: u32,
pub bounties_completed: u32,
pub total_earned: u64,
pub slash_count: u8,
```

## Events

All state changes emit Anchor events for off-chain indexing:

- `BountyCreatedEvent` — issue_number, reward, tier, creator
- `BountyCompletedEvent` — bounty, contributor, reward_paid
- `BountyCancelledEvent` — bounty, canceller
- `ContributorRegisteredEvent` — contributor_account, authority, tier
- `ContributorSlashedEvent` — contributor_account, slash_amount

## Building & Testing

### Prerequisites
- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.30.1
- Node.js 18+

### Build

```bash
cd programs/bounty-registry
anchor build
```

### Test

```bash
anchor test
```

Tests cover all 6 instructions including error cases:
- Double initialization
- Zero-reward bounty
- Invalid tier
- Unauthorized slash
- Auto-ban after 3 slashes
- Complete bounty escrow release

## Security Notes

- Escrow PDAs are owned by the bounty PDA — funds can only be released via program instructions
- `complete_bounty` requires admin co-signature to prevent self-approval
- `cancel_bounty` and `slash_contributor` are admin-only
- Tier validation enforces values 1–3 only
- All string fields have maximum length enforcement
