//! Initiate unstaking with a 7-day cooldown period.
//!
//! The user declares the amount they wish to unstake. The tokens remain
//! locked in the vault during the cooldown. After the cooldown elapses,
//! [`unstake_complete`](super::unstake_complete) transfers them back.

use anchor_lang::prelude::*;

use crate::errors::StakingError;
use crate::events::UnstakeInitiatedEvent;
use crate::instructions::stake::calculate_rewards;
use crate::state::{StakeAccount, StakingConfig};

/// Accounts required for the `unstake_initiate` instruction.
#[derive(Accounts)]
pub struct UnstakeInitiate<'info> {
    /// The user initiating the unstake.
    pub user: Signer<'info>,

    /// Global staking configuration PDA.
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.config_bump,
    )]
    pub config: Box<Account<'info, StakingConfig>>,

    /// The user's stake account PDA.
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub stake_account: Box<Account<'info, StakeAccount>>,
}

/// Initiates the unstake cooldown for the specified amount.
///
/// # Arguments
///
/// * `ctx` - Instruction context with validated accounts.
/// * `amount` - Amount of tokens to unstake (must be <= staked balance).
///
/// # Flow
///
/// 1. Validates no cooldown is already active.
/// 2. Accrues pending rewards before modifying the stake.
/// 3. Sets the cooldown start time and amount.
/// 4. Emits an [`UnstakeInitiatedEvent`].
///
/// # Errors
///
/// - [`StakingError::ProgramPaused`] if the program is paused.
/// - [`StakingError::ZeroUnstakeAmount`] if amount is 0.
/// - [`StakingError::CooldownAlreadyActive`] if a cooldown is in progress.
/// - [`StakingError::InsufficientStake`] if amount exceeds staked balance.
pub fn handler(ctx: Context<UnstakeInitiate>, amount: u64) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, StakingError::ProgramPaused);
    require!(amount > 0, StakingError::ZeroUnstakeAmount);

    let stake_account = &mut ctx.accounts.stake_account;

    require!(!stake_account.cooldown_active, StakingError::CooldownAlreadyActive);
    require!(amount <= stake_account.amount, StakingError::InsufficientStake);

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    // Accrue rewards before modifying the position.
    let accrued = calculate_rewards(
        stake_account.amount,
        stake_account.last_claim,
        current_timestamp,
        config.apy_bps_for_amount(stake_account.amount),
    )?;
    stake_account.pending_rewards = stake_account
        .pending_rewards
        .checked_add(accrued)
        .ok_or(StakingError::MathOverflow)?;
    stake_account.last_claim = current_timestamp;

    // Start cooldown.
    stake_account.cooldown_active = true;
    stake_account.cooldown_start = current_timestamp;
    stake_account.cooldown_amount = amount;

    // IMPORTANT: Subtract from active stake IMMEDIATELY to prevent "double-dipping" rewards
    // during the 7-day cooldown period. The tokens remain in the vault but are no longer
    // considered "staked" for reward calculations.
    stake_account.amount = stake_account
        .amount
        .checked_sub(amount)
        .ok_or(StakingError::MathOverflow)?;

    // Update global stats immediately.
    let config_mut = &mut ctx.accounts.config;
    config_mut.total_staked = config_mut
        .total_staked
        .checked_sub(amount)
        .ok_or(StakingError::MathOverflow)?;

    if stake_account.amount == 0 {
        config_mut.active_stakers = config_mut.active_stakers.saturating_sub(1);
    }

    let cooldown_end = current_timestamp
        .checked_add(config_mut.cooldown_seconds)
        .ok_or(StakingError::MathOverflow)?;

    emit!(UnstakeInitiatedEvent {
        user: ctx.accounts.user.key(),
        amount,
        cooldown_start: current_timestamp,
        cooldown_end,
    });

    msg!(
        "Unstake initiated: {} tokens, cooldown ends at {}",
        amount,
        cooldown_end
    );

    Ok(())
}
