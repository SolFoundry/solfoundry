//! Compound (auto-restake) accumulated rewards.
//!
//! Instead of transferring reward tokens to the user, this instruction
//! transfers them from the reward pool into the user's stake vault,
//! effectively increasing their staked position and future yield.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingError;
use crate::events::CompoundEvent;
use crate::instructions::stake::calculate_rewards;
use crate::state::{StakeAccount, StakingConfig};

/// Accounts required for the `compound` instruction.
#[derive(Accounts)]
pub struct Compound<'info> {
    /// The user compounding their rewards.
    #[account(mut)]
    pub user: Signer<'info>,

    /// Global staking configuration PDA.
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.config_bump,
    )]
    pub config: Account<'info, StakingConfig>,

    /// The user's stake account PDA.
    #[account(
        mut,
        seeds = [b"stake", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ StakingError::Unauthorized,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// The reward pool token account (source of compounded tokens).
    #[account(
        mut,
        constraint = reward_pool_vault.key() == config.reward_pool_vault @ StakingError::Unauthorized,
    )]
    pub reward_pool_vault: Account<'info, TokenAccount>,

    /// PDA-owned stake vault to receive the compounded tokens.
    #[account(
        mut,
        seeds = [b"stake_vault", user.key().as_ref()],
        bump,
    )]
    pub stake_vault: Account<'info, TokenAccount>,

    /// Vault authority PDA that controls both vaults.
    /// CHECK: PDA used as token account authority, validated by seeds.
    #[account(
        seeds = [b"vault_authority"],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// SPL Token program.
    pub token_program: Program<'info, Token>,
}

/// Compounds all pending and newly accrued rewards into the stake.
///
/// # Arguments
///
/// * `ctx` - Instruction context with validated accounts.
///
/// # Flow
///
/// 1. Calculates total pending rewards (accrued + previously pending).
/// 2. Validates the reward pool has sufficient funds.
/// 3. Transfers reward tokens from the pool into the stake vault.
/// 4. Increases the staked amount by the compounded rewards.
/// 5. Updates global stats (total_staked increases, rewards distributed).
/// 6. Emits a [`CompoundEvent`].
///
/// # Errors
///
/// - [`StakingError::ProgramPaused`] if paused.
/// - [`StakingError::NoRewardsToClaim`] if no rewards to compound.
/// - [`StakingError::InsufficientRewardPool`] if pool can't cover it.
pub fn handler(ctx: Context<Compound>) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, StakingError::ProgramPaused);

    let clock = Clock::get()?;
    let current_timestamp = clock.unix_timestamp;

    let stake_account = &ctx.accounts.stake_account;

    // Calculate newly accrued rewards.
    let newly_accrued = calculate_rewards(
        stake_account.amount,
        stake_account.last_claim,
        current_timestamp,
        config.apy_bps_for_amount(stake_account.amount),
    )?;

    let total_rewards = stake_account
        .pending_rewards
        .checked_add(newly_accrued)
        .ok_or(StakingError::MathOverflow)?;

    require!(total_rewards > 0, StakingError::NoRewardsToClaim);

    // Validate reward pool has sufficient funds.
    require!(
        ctx.accounts.reward_pool_vault.amount >= total_rewards,
        StakingError::InsufficientRewardPool
    );

    // Transfer rewards from pool to stake vault via PDA signer.
    let vault_authority_bump = config.vault_authority_bump;
    let vault_authority_seeds: &[&[u8]] = &[b"vault_authority", &[vault_authority_bump]];
    let signer_seeds = &[vault_authority_seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.reward_pool_vault.to_account_info(),
            to: ctx.accounts.stake_vault.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, total_rewards)?;

    // Update stake account: increase staked amount, reset rewards.
    let stake_account = &mut ctx.accounts.stake_account;
    stake_account.amount = stake_account
        .amount
        .checked_add(total_rewards)
        .ok_or(StakingError::MathOverflow)?;
    stake_account.rewards_earned = stake_account
        .rewards_earned
        .checked_add(total_rewards)
        .ok_or(StakingError::MathOverflow)?;
    stake_account.pending_rewards = 0;
    stake_account.last_claim = current_timestamp;

    // Update global stats.
    let config = &mut ctx.accounts.config;
    config.total_staked = config
        .total_staked
        .checked_add(total_rewards)
        .ok_or(StakingError::MathOverflow)?;
    config.total_rewards_distributed = config
        .total_rewards_distributed
        .checked_add(total_rewards)
        .ok_or(StakingError::MathOverflow)?;

    let new_tier = config.tier_for_amount(stake_account.amount).unwrap_or(0);

    emit!(CompoundEvent {
        user: ctx.accounts.user.key(),
        compounded_amount: total_rewards,
        new_total_staked: stake_account.amount,
        new_tier,
        timestamp: current_timestamp,
    });

    msg!(
        "Compounded {} reward tokens. New staked total: {}",
        total_rewards,
        stake_account.amount
    );

    Ok(())
}
