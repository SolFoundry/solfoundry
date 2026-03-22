//! Claim accumulated staking rewards.
//!
//! Calculates rewards earned since `last_claim` based on the user's
//! staked amount and tier APY, then transfers from the reward pool
//! vault to the user's token account.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::errors::StakingError;
use crate::events::ClaimRewardsEvent;
use crate::instructions::stake::calculate_rewards;
use crate::state::{StakeAccount, StakingConfig};

/// Accounts required for the `claim_rewards` instruction.
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    /// The user claiming rewards.
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

    /// The reward pool token account (source of reward tokens).
    #[account(
        mut,
        constraint = reward_pool_vault.key() == config.reward_pool_vault @ StakingError::Unauthorized,
    )]
    pub reward_pool_vault: Account<'info, TokenAccount>,

    /// The user's token account to receive reward tokens.
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ StakingError::Unauthorized,
        constraint = user_token_account.mint == config.token_mint @ StakingError::Unauthorized,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault authority PDA that controls the reward pool vault.
    /// CHECK: PDA used as token account authority, validated by seeds.
    #[account(
        seeds = [b"vault_authority"],
        bump = config.vault_authority_bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// SPL Token program.
    pub token_program: Program<'info, Token>,
}

/// Claims all pending and newly accrued rewards.
///
/// # Arguments
///
/// * `ctx` - Instruction context with validated accounts.
///
/// # Flow
///
/// 1. Calculates rewards accrued since `last_claim`.
/// 2. Adds any previously accumulated `pending_rewards`.
/// 3. Validates the reward pool has sufficient funds.
/// 4. Transfers reward tokens from the pool to the user.
/// 5. Updates the stake account and global stats.
/// 6. Emits a [`ClaimRewardsEvent`].
///
/// # Errors
///
/// - [`StakingError::ProgramPaused`] if paused.
/// - [`StakingError::NoRewardsToClaim`] if computed rewards are zero.
/// - [`StakingError::InsufficientRewardPool`] if pool can't cover the payout.
pub fn handler(ctx: Context<ClaimRewards>) -> Result<()> {
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

    // Transfer rewards from pool to user via PDA signer.
    let vault_authority_bump = config.vault_authority_bump;
    let vault_authority_seeds: &[&[u8]] = &[b"vault_authority", &[vault_authority_bump]];
    let signer_seeds = &[vault_authority_seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.reward_pool_vault.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.vault_authority.to_account_info(),
        },
        signer_seeds,
    );
    token::transfer(transfer_ctx, total_rewards)?;

    // Update stake account.
    let stake_account = &mut ctx.accounts.stake_account;
    stake_account.rewards_earned = stake_account
        .rewards_earned
        .checked_add(total_rewards)
        .ok_or(StakingError::MathOverflow)?;
    stake_account.pending_rewards = 0;
    stake_account.last_claim = current_timestamp;

    // Update global stats.
    let config = &mut ctx.accounts.config;
    config.total_rewards_distributed = config
        .total_rewards_distributed
        .checked_add(total_rewards)
        .ok_or(StakingError::MathOverflow)?;

    emit!(ClaimRewardsEvent {
        user: ctx.accounts.user.key(),
        rewards_claimed: total_rewards,
        total_lifetime_rewards: stake_account.rewards_earned,
        timestamp: current_timestamp,
    });

    msg!("Claimed {} reward tokens", total_rewards);

    Ok(())
}
