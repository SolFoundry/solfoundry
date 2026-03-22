//! Per-user stake account PDA.
//!
//! Each user has at most one [`StakeAccount`] derived with seeds
//! `["stake", user_pubkey]`. It tracks their staked amount, timestamps,
//! accumulated rewards, and optional unstake cooldown state.

use anchor_lang::prelude::*;

/// Per-user staking account PDA.
///
/// Seeds: `["stake", user_pubkey]`.
///
/// Tracks the user's staked token amount, timestamps for reward
/// calculation, accumulated unclaimed rewards, and cooldown state
/// for the 7-day unbonding period.
#[account]
#[derive(Debug)]
pub struct StakeAccount {
    /// The wallet that owns this stake.
    pub owner: Pubkey,

    /// Amount of $FNDRY currently staked (in base units, 6 decimals).
    pub amount: u64,

    /// Unix timestamp when the user first staked (or last fully restaked).
    pub staked_at: i64,

    /// Unix timestamp of the last reward claim or compound.
    pub last_claim: i64,

    /// Total rewards earned and claimed over the lifetime of this account.
    pub rewards_earned: u64,

    /// Pending (unclaimed) rewards accumulated since `last_claim`.
    pub pending_rewards: u64,

    /// Whether an unstake cooldown is currently active.
    pub cooldown_active: bool,

    /// Unix timestamp when the cooldown started (0 if not active).
    pub cooldown_start: i64,

    /// Amount being unstaked during cooldown.
    pub cooldown_amount: u64,

    /// Whether auto-compound is enabled for this stake.
    pub auto_compound: bool,

    /// Bump seed for this PDA.
    pub bump: u8,
}

impl StakeAccount {
    /// Space required for account allocation.
    ///
    /// 8 (discriminator) + 32 (owner) + 8 (amount) + 8 (staked_at) +
    /// 8 (last_claim) + 8 (rewards_earned) + 8 (pending_rewards) +
    /// 1 (cooldown_active) + 8 (cooldown_start) + 8 (cooldown_amount) +
    /// 1 (auto_compound) + 1 (bump)
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 8 + 8 + 1 + 1;

    /// Returns `true` if the cooldown period has elapsed.
    ///
    /// # Arguments
    ///
    /// * `current_timestamp` - Current on-chain clock unix timestamp.
    /// * `cooldown_seconds` - Required cooldown duration from config.
    pub fn cooldown_elapsed(&self, current_timestamp: i64, cooldown_seconds: i64) -> bool {
        if !self.cooldown_active {
            return false;
        }
        current_timestamp >= self.cooldown_start.saturating_add(cooldown_seconds)
    }
}
