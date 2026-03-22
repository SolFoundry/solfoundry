# FNDRY Staking Program

## Overview

The FNDRY staking program allows users to lock $FNDRY tokens to earn yield, boost their reputation score, and gain priority access to high-value bounties in the SolFoundry ecosystem. Staking creates skin in the game and reduces circulating supply.

## Staking Mechanics

### Stake Lifecycle

```
User deposits tokens → Stake Account created → Rewards accrue linearly
                                                        │
                    ┌───────────────────────────────────┘
                    │
          ┌─────────────────┐
          │  Claim Rewards   │──→ Tokens sent to user wallet
          │  Compound        │──→ Rewards added to stake balance
          │  Unstake Initiate│──→ 7-day cooldown begins
          └─────────────────┘
                    │
          Unstake Complete (after 7 days) → Tokens returned to user
```

### Reward Formula

Rewards are calculated using a simple linear formula proportional to stake amount and duration:

```
reward = amount × apy_bps × duration_seconds / (10,000 × SECONDS_PER_YEAR)
```

Where:
- `amount` = staked token amount (in base units, 6 decimals)
- `apy_bps` = annual percentage yield in basis points (1 bp = 0.01%)
- `duration_seconds` = time since last claim in seconds
- `SECONDS_PER_YEAR` = 31,536,000 (365 days)

All arithmetic uses u128 intermediates to prevent overflow.

### Examples

| Stake Amount | Tier | APY | Duration | Reward |
|-------------|------|-----|----------|--------|
| 10,000 $FNDRY | Bronze | 5.00% | 1 year | 500 $FNDRY |
| 50,000 $FNDRY | Silver | 8.00% | 1 year | 4,000 $FNDRY |
| 100,000 $FNDRY | Gold | 12.00% | 1 year | 12,000 $FNDRY |
| 100,000 $FNDRY | Gold | 12.00% | 30 days | ~986 $FNDRY |

## Tier Thresholds

| Tier | Minimum Stake | APY | Benefits |
|------|--------------|-----|----------|
| Bronze | 10,000 $FNDRY | 5.00% | Base yield + 1.5x reputation |
| Silver | 50,000 $FNDRY | 8.00% | Higher yield + 1.5x reputation |
| Gold | 100,000 $FNDRY | 12.00% | Maximum yield + 1.5x reputation |

Tier thresholds and APY rates are configurable by the admin via `update_config`.

## Account Structure

### StakingConfig (Global — 1 per deployment)

| Field | Type | Description |
|-------|------|-------------|
| admin | Pubkey | Admin authority for config updates and slashes |
| token_mint | Pubkey | $FNDRY SPL token mint |
| reward_pool_vault | Pubkey | PDA-owned token account holding reward funds |
| config_bump | u8 | PDA bump seed |
| vault_authority_bump | u8 | Vault authority PDA bump |
| tier_thresholds | [u64; 3] | Min stake for each tier (Bronze, Silver, Gold) |
| tier_apy_bps | [u16; 3] | APY in basis points per tier |
| cooldown_seconds | i64 | Unstake cooldown duration (default: 604,800 = 7 days) |
| total_staked | u64 | Global total staked across all users |
| total_rewards_distributed | u64 | Lifetime rewards paid out |
| active_stakers | u64 | Count of active stake accounts |
| paused | bool | Emergency pause flag |

### StakeAccount (Per-user)

| Field | Type | Description |
|-------|------|-------------|
| owner | Pubkey | Wallet that owns this stake |
| amount | u64 | Currently staked amount (base units) |
| staked_at | i64 | Timestamp of initial stake |
| last_claim | i64 | Timestamp of last reward claim |
| rewards_earned | u64 | Lifetime rewards claimed |
| pending_rewards | u64 | Unclaimed rewards since last_claim |
| cooldown_active | bool | Whether unstake cooldown is in progress |
| cooldown_start | i64 | Timestamp cooldown began |
| cooldown_amount | u64 | Amount being unstaked |
| auto_compound | bool | Whether auto-compound is enabled |
| bump | u8 | PDA bump seed |

## PDA Seeds

| Account | Seeds | Description |
|---------|-------|-------------|
| StakingConfig | `["config"]` | Global config (one per program) |
| StakeAccount | `["stake", user_pubkey]` | Per-user stake data |
| Stake Vault | `["stake_vault", user_pubkey]` | Per-user token escrow |
| Vault Authority | `["vault_authority"]` | PDA signer for token transfers |
| Reward Pool | `["reward_pool"]` | Holds reward tokens for distribution |

## Instructions

### `initialize`
Creates the global config and reward pool. Called once by the deployer.

### `stake(amount: u64)`
Deposits tokens into the staking vault. Creates the stake account on first call. Amount must result in at least Bronze tier threshold.

### `unstake_initiate(amount: u64)`
Begins the 7-day unbonding period. Only one cooldown can be active at a time. Accrues pending rewards before starting.

### `unstake_complete`
Completes the unstake after cooldown elapses. Returns tokens to user's wallet.

### `claim_rewards`
Claims all accrued rewards (pending + newly calculated). Transfers from reward pool to user.

### `compound`
Auto-restakes accrued rewards. Transfers from reward pool to stake vault, increasing the staked balance.

### `toggle_auto_compound(enabled: bool)`
Sets the auto-compound preference flag.

### `slash(user_pubkey: Pubkey, amount: u64)`
Admin-only. Reduces a user's stake and transfers slashed tokens to the reward pool.

### `update_config(params: ConfigUpdateParams)`
Admin-only. Updates tier thresholds, APY rates, cooldown duration, or paused state.

## Security Considerations

- **Overflow-safe math**: All arithmetic uses checked operations with u128 intermediates.
- **Authority checks**: Every instruction validates the signer via Anchor constraints.
- **Clock validation**: Time-dependent calculations use on-chain Clock sysvar.
- **No self-referential rewards**: Users cannot generate rewards from reward tokens.
- **Emergency pause**: Admin can halt all operations instantly via `update_config(paused: true)`.
- **PDA-controlled vaults**: All token accounts are owned by program PDAs, not external wallets.

## Reputation Boost

All stakers receive a 1.5x reputation multiplier regardless of tier. This is enforced via CPI to the reputation program. The multiplier is applied when the reputation program queries the staking program to check if a user has an active stake.

## Token Addresses

- **$FNDRY CA**: `C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS`
- **Treasury**: `57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp`
