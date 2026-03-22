//! # FNDRY Staking Program
//!
//! An Anchor-based Solana program for staking $FNDRY tokens to earn
//! yield, boost reputation, and gain priority access to high-value
//! bounties in the SolFoundry ecosystem.
//!
//! ## Features
//!
//! - **Stake / Unstake**: Lock $FNDRY tokens with a 7-day unbonding cooldown.
//! - **Tiered APY**: Bronze (5%), Silver (8%), Gold (12%) based on staked amount.
//! - **Reward Claims**: Linear reward calculation proportional to stake and duration.
//! - **Auto-Compound**: Optional automatic restaking of earned rewards.
//! - **Slash Mechanism**: Admin-only penalty for bad behavior.
//! - **Reputation Boost**: Stakers receive a 1.5x reputation multiplier (via CPI).
//!
//! ## PDA Seeds
//!
//! | Account | Seeds |
//! |---------|-------|
//! | StakingConfig | `["config"]` |
//! | StakeAccount | `["stake", user_pubkey]` |
//! | Stake Vault | `["stake_vault", user_pubkey]` |
//! | Vault Authority | `["vault_authority"]` |
//! | Reward Pool | `["reward_pool"]` |
//!
//! ## Security
//!
//! - All arithmetic uses overflow-safe checked operations (u128 intermediates).
//! - Authority checks on every instruction via Anchor constraints.
//! - Clock validation for time-dependent reward calculations.
//! - Admin-only access for slash and config updates.

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("Stak1111111111111111111111111111111111111111");

/// The FNDRY staking program.
///
/// Provides instructions for staking $FNDRY tokens, claiming rewards,
/// compounding, unstaking with cooldown, and admin operations (slash,
/// config updates).
#[program]
pub mod fndry_staking {
    use super::*;

    /// Initializes the staking program configuration.
    ///
    /// Creates the global config PDA with default tier thresholds,
    /// APY rates, and cooldown duration. Also creates the reward pool
    /// token account owned by the vault authority PDA.
    ///
    /// # Access
    ///
    /// Can only be called once (config PDA is unique).
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Stakes $FNDRY tokens into the staking program.
    ///
    /// Transfers tokens from the user's wallet to a PDA-owned vault.
    /// Creates the user's stake account on first call, or adds to
    /// an existing position. The staked amount must meet at least the
    /// Bronze tier threshold (10,000 $FNDRY).
    ///
    /// # Arguments
    ///
    /// * `amount` - Number of $FNDRY tokens to stake (base units, 6 decimals).
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        instructions::stake::handler(ctx, amount)
    }

    /// Initiates unstaking with a 7-day cooldown.
    ///
    /// The user declares the amount to unstake. Tokens remain locked
    /// in the vault during the cooldown period. Only one cooldown can
    /// be active at a time per user.
    ///
    /// # Arguments
    ///
    /// * `amount` - Number of tokens to unstake (must be <= staked balance).
    pub fn unstake_initiate(ctx: Context<UnstakeInitiate>, amount: u64) -> Result<()> {
        instructions::unstake_initiate::handler(ctx, amount)
    }

    /// Completes the unstake after the cooldown period has elapsed.
    ///
    /// Transfers the cooldown amount from the PDA vault back to the
    /// user's token account. Fails if called before the 7-day
    /// cooldown has passed.
    pub fn unstake_complete(ctx: Context<UnstakeComplete>) -> Result<()> {
        instructions::unstake_complete::handler(ctx)
    }

    /// Claims all accumulated staking rewards.
    ///
    /// Calculates rewards earned since the last claim based on the
    /// staked amount, duration, and tier-based APY. Transfers reward
    /// tokens from the reward pool to the user.
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        instructions::claim_rewards::handler(ctx)
    }

    /// Compounds accumulated rewards into the stake.
    ///
    /// Instead of transferring rewards to the user's wallet, this
    /// adds them to the staked balance, increasing future yield.
    /// Equivalent to claiming and immediately re-staking.
    pub fn compound(ctx: Context<Compound>) -> Result<()> {
        instructions::compound::handler(ctx)
    }

    /// Slashes a user's stake as a penalty for bad behavior.
    ///
    /// Admin-only. Transfers slashed tokens from the user's vault
    /// to the reward pool (recycled as future rewards).
    ///
    /// # Arguments
    ///
    /// * `user_pubkey` - The public key of the user to slash.
    /// * `amount` - Number of tokens to slash.
    pub fn slash(ctx: Context<Slash>, user_pubkey: Pubkey, amount: u64) -> Result<()> {
        instructions::slash::handler(ctx, user_pubkey, amount)
    }

    /// Toggles the auto-compound flag on the user's stake.
    ///
    /// When enabled, off-chain keepers may call `compound` on the
    /// user's behalf at regular intervals.
    ///
    /// # Arguments
    ///
    /// * `enabled` - `true` to enable, `false` to disable.
    pub fn toggle_auto_compound(ctx: Context<ToggleAutoCompound>, enabled: bool) -> Result<()> {
        instructions::toggle_auto_compound::handler(ctx, enabled)
    }

    /// Updates the staking program configuration.
    ///
    /// Admin-only. Allows modifying tier thresholds, APY rates,
    /// cooldown duration, and paused state without redeployment.
    ///
    /// # Arguments
    ///
    /// * `params` - Configuration parameters to update (only non-None fields applied).
    pub fn update_config(ctx: Context<UpdateConfig>, params: ConfigUpdateParams) -> Result<()> {
        instructions::update_config::handler(ctx, params)
    }
}
