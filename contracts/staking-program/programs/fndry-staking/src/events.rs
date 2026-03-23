//! Events emitted by the FNDRY staking program.
//!
//! These events are recorded in the Solana transaction log and can be
//! parsed by off-chain indexers to track staking activity in real time.

use anchor_lang::prelude::*;

/// Emitted when a user stakes $FNDRY tokens.
#[event]
pub struct StakeEvent {
    /// The user's wallet public key.
    pub user: Pubkey,
    /// Amount of tokens staked in this transaction.
    pub amount: u64,
    /// Total staked balance after this transaction.
    pub total_staked: u64,
    /// Tier index achieved (0=Bronze, 1=Silver, 2=Gold).
    pub tier: u8,
    /// Unix timestamp of the stake.
    pub timestamp: i64,
}

/// Emitted when a user initiates an unstake cooldown.
#[event]
pub struct UnstakeInitiatedEvent {
    /// The user's wallet public key.
    pub user: Pubkey,
    /// Amount being unstaked.
    pub amount: u64,
    /// Unix timestamp when the cooldown started.
    pub cooldown_start: i64,
    /// Unix timestamp when the cooldown will end.
    pub cooldown_end: i64,
}

/// Emitted when a user completes the unstake after cooldown.
#[event]
pub struct UnstakeCompletedEvent {
    /// The user's wallet public key.
    pub user: Pubkey,
    /// Amount of tokens returned to the user.
    pub amount: u64,
    /// Remaining staked balance.
    pub remaining_staked: u64,
    /// Unix timestamp of completion.
    pub timestamp: i64,
}

/// Emitted when a user claims accumulated rewards.
#[event]
pub struct ClaimRewardsEvent {
    /// The user's wallet public key.
    pub user: Pubkey,
    /// Amount of rewards claimed.
    pub rewards_claimed: u64,
    /// Total lifetime rewards earned after this claim.
    pub total_lifetime_rewards: u64,
    /// Unix timestamp of the claim.
    pub timestamp: i64,
}

/// Emitted when a user compounds (auto-restakes) their rewards.
#[event]
pub struct CompoundEvent {
    /// The user's wallet public key.
    pub user: Pubkey,
    /// Amount of rewards compounded into the stake.
    pub compounded_amount: u64,
    /// New total staked balance after compounding.
    pub new_total_staked: u64,
    /// New tier index after compounding.
    pub new_tier: u8,
    /// Unix timestamp of the compound.
    pub timestamp: i64,
}

/// Emitted when the admin slashes a user's stake.
#[event]
pub struct SlashEvent {
    /// The admin who performed the slash.
    pub admin: Pubkey,
    /// The user whose stake was slashed.
    pub user: Pubkey,
    /// Amount of tokens slashed.
    pub slash_amount: u64,
    /// Remaining staked balance after slash.
    pub remaining_staked: u64,
    /// Unix timestamp of the slash.
    pub timestamp: i64,
}

/// Emitted when auto-compound is toggled for a user's stake.
#[event]
pub struct AutoCompoundToggleEvent {
    /// The user's wallet public key.
    pub user: Pubkey,
    /// New auto-compound setting.
    pub enabled: bool,
    /// Unix timestamp of the toggle.
    pub timestamp: i64,
}
