//! Custom error codes for the FNDRY staking program.
//!
//! Each variant maps to a unique error code that clients can match
//! against for structured error handling. Error codes start at 6000
//! (Anchor convention for custom errors).

use anchor_lang::prelude::*;

/// Custom errors emitted by the FNDRY staking program.
#[error_code]
pub enum StakingError {
    /// The staked amount is below the minimum Bronze tier threshold.
    #[msg("Stake amount is below the minimum threshold for Bronze tier")]
    BelowMinimumStake,

    /// An arithmetic overflow occurred during reward calculation.
    #[msg("Arithmetic overflow in reward calculation")]
    MathOverflow,

    /// The unstake cooldown period has not yet elapsed.
    #[msg("Unstake cooldown period has not elapsed — 7 days required")]
    CooldownNotElapsed,

    /// An unstake cooldown is already in progress for this account.
    #[msg("An unstake cooldown is already active")]
    CooldownAlreadyActive,

    /// No cooldown is active, so there is nothing to complete.
    #[msg("No active cooldown to complete unstake")]
    NoCooldownActive,

    /// The user has no pending rewards to claim.
    #[msg("No rewards available to claim")]
    NoRewardsToClaim,

    /// The requested unstake amount exceeds the staked balance.
    #[msg("Unstake amount exceeds staked balance")]
    InsufficientStake,

    /// The reward pool does not have enough tokens for this payout.
    #[msg("Reward pool has insufficient funds for payout")]
    InsufficientRewardPool,

    /// The staking program is currently paused by the admin.
    #[msg("Staking program is paused")]
    ProgramPaused,

    /// The caller is not the admin authority.
    #[msg("Unauthorized — caller is not the admin authority")]
    Unauthorized,

    /// The slash amount exceeds the user's staked balance.
    #[msg("Slash amount exceeds the user's staked balance")]
    SlashExceedsStake,

    /// The provided clock timestamp is invalid or in the future.
    #[msg("Invalid clock timestamp")]
    InvalidTimestamp,

    /// The unstake amount must be greater than zero.
    #[msg("Unstake amount must be greater than zero")]
    ZeroUnstakeAmount,

    /// The stake amount must be greater than zero.
    #[msg("Stake amount must be greater than zero")]
    ZeroStakeAmount,

    /// The slash amount must be greater than zero.
    #[msg("Slash amount must be greater than zero")]
    ZeroSlashAmount,
}
