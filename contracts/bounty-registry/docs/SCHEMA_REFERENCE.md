# Bounty Registry — Schema Reference

On-chain account structures, enumerations, and PDA derivation for the SolFoundry bounty registry program.

## Program ID

```
DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe
```

## Account: BountyRecord

The primary on-chain account storing all metadata for a single bounty.

### PDA Derivation

```
Seeds: ["registry", bounty_id.to_le_bytes()]
```

Where `bounty_id` is a `u64` encoded as 8 bytes in little-endian order.

### Fields

| Field           | Type             | Size (bytes) | Description                                                  |
|-----------------|------------------|--------------|--------------------------------------------------------------|
| bounty_id       | u64              | 8            | Unique numeric identifier                                    |
| title           | String (max 64)  | 4 + 64       | Human-readable bounty title                                  |
| tier            | u8               | 1            | Bounty tier: 1, 2, or 3                                      |
| reward_amount   | u64              | 8            | Reward in smallest token unit (metadata only, no custody)    |
| status          | BountyStatus     | 1            | Current lifecycle status                                     |
| creator         | Pubkey           | 32           | Admin who registered the bounty                              |
| contributor     | Option\<Pubkey\> | 1 + 32       | Contributor who claimed the bounty (null if unclaimed)       |
| github_issue    | String (max 128) | 4 + 128      | GitHub issue URL or identifier                               |
| github_pr       | String (max 128) | 4 + 128      | GitHub PR URL (empty until completion)                       |
| review_scores   | Vec\<u16\>       | 4 + 10       | Five LLM model scores (0-1000, representing 0.0-10.0)       |
| final_score     | u16              | 2            | Aggregated final review score (0-1000)                       |
| pr_hash         | Option\<[u8;32]\>| 1 + 32       | SHA-256 hash of merged PR diff                               |
| created_at      | i64              | 8            | Unix timestamp of registration                               |
| updated_at      | i64              | 8            | Unix timestamp of last update                                |
| completed_at    | Option\<i64\>    | 1 + 8        | Unix timestamp of completion (null if not completed)         |
| bump            | u8               | 1            | PDA bump seed                                                |

**Total account size**: 8 (discriminator) + 531 (data) = 539 bytes

## Enum: BountyStatus

| Variant    | Value | Description                                    |
|------------|-------|------------------------------------------------|
| Open       | 0     | Available for claiming                         |
| Claimed    | 1     | Contributor is working on it                   |
| InReview   | 2     | PR submitted, under multi-LLM review          |
| Completed  | 3     | PR merged, bounty fulfilled (terminal)         |
| Cancelled  | 4     | Bounty cancelled (terminal)                    |

### State Machine

```
Open ──→ Claimed ──→ InReview ──→ Completed
 │          │
 └──→ Cancelled ←──┘
```

**Terminal states**: Completed and Cancelled allow no further transitions.

## Instructions

### register_bounty

Creates a new bounty record PDA.

| Parameter    | Type   | Constraints                |
|-------------|--------|----------------------------|
| bounty_id   | u64    | Must be unique             |
| title       | String | Max 64 bytes               |
| tier        | u8     | Must be 1, 2, or 3        |
| reward_amount| u64   | Any valid u64              |
| github_issue| String | Max 128 bytes              |

**Accounts**: admin (signer, mut), bounty_record (init), system_program

### update_status

Transitions a bounty to a new lifecycle status.

| Parameter    | Type            | Constraints                         |
|-------------|-----------------|-------------------------------------|
| new_status  | u8              | Valid BountyStatus (0-4)            |
| contributor | Option\<Pubkey\>| Required when new_status = Claimed  |

**Accounts**: admin (signer, mut, must be creator), bounty_record (mut)

### record_completion

Records review pipeline results and transitions to Completed.

| Parameter     | Type       | Constraints                          |
|--------------|------------|--------------------------------------|
| github_pr    | String     | Max 128 bytes                        |
| review_scores| Vec\<u16\> | Exactly 5 values, each 0-1000       |
| final_score  | u16        | 0-1000                               |
| pr_hash      | [u8; 32]   | SHA-256 hash of PR diff              |

**Accounts**: admin (signer, mut, must be creator), bounty_record (mut, must be InReview)

### close_bounty

Cancels a bounty (no parameters).

**Accounts**: admin (signer, mut, must be creator), bounty_record (mut, must not be terminal)

## Events

| Event              | Fields                                                           |
|--------------------|------------------------------------------------------------------|
| BountyRegistered   | bounty_id, title, tier, reward_amount, github_issue, creator, created_at |
| BountyStatusUpdated| bounty_id, previous_status, new_status, contributor, updated_at  |
| BountyCompleted    | bounty_id, github_pr, review_scores, final_score, pr_hash, contributor, completed_at |
| BountyClosed       | bounty_id, previous_status, closed_at                            |

## Error Codes

| Code | Name                        | Description                                    |
|------|-----------------------------|------------------------------------------------|
| 6000 | TitleTooLong                | Title exceeds 64 bytes                         |
| 6001 | InvalidTier                 | Tier is not 1, 2, or 3                         |
| 6002 | GithubReferenceTooLong      | GitHub ref exceeds 128 bytes                   |
| 6003 | InvalidStatusTransition     | State machine violation                        |
| 6004 | ContributorRequiredForClaim | Missing contributor on claim                   |
| 6005 | BountyAlreadyClosed         | Mutation on terminal state                     |
| 6006 | InvalidStatusValue          | Raw value not 0-4                              |
| 6007 | InvalidStatusForCompletion  | Not in InReview for completion                 |
| 6008 | InvalidScoreCount           | Not exactly 5 review scores                    |
| 6009 | ScoreOutOfRange             | Score exceeds 1000                             |
| 6010 | ArithmeticOverflow          | Numeric overflow detected                      |
| 6011 | Unauthorized                | Signer is not the admin                        |
