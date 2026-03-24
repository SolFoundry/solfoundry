//! Initialize the global staking configuration.
//!
//! Called once by the deployer to set up the config PDA, the vault
//! authority PDA, and the reward pool token account. After initialization,
//! the `admin` field in config controls all privileged operations.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::{
    StakingConfig, DEFAULT_COOLDOWN_SECONDS, DEFAULT_TIER_APY_BPS, DEFAULT_TIER_THRESHOLDS,
};

/// Accounts required for the `initialize` instruction.
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The admin who will manage the staking program.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Global staking configuration PDA.
    /// Seeds: `["config"]`.
    #[account(
        init,
        payer = admin,
        space = StakingConfig::SPACE,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, StakingConfig>,

    /// The $FNDRY token mint.
    pub token_mint: Account<'info, Mint>,

    /// PDA authority that owns the reward pool vault.
    /// Seeds: `["vault_authority"]`.
    /// CHECK: This is a PDA used as the token account authority.
    #[account(
        seeds = [b"vault_authority"],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The reward pool token account, owned by the vault_authority PDA.
    #[account(
        init,
        payer = admin,
        token::mint = token_mint,
        token::authority = vault_authority,
        seeds = [b"reward_pool"],
        bump,
    )]
    pub reward_pool_vault: Account<'info, TokenAccount>,

    /// Solana system program.
    pub system_program: Program<'info, System>,

    /// SPL Token program.
    pub token_program: Program<'info, Token>,

    /// Rent sysvar for account creation.
    pub rent: Sysvar<'info, Rent>,
}

/// Initializes the staking program with default tier thresholds and APY rates.
///
/// # Arguments
///
/// * `ctx` - The instruction context containing all required accounts.
///
/// # Effects
///
/// - Creates the config PDA with default parameters.
/// - Creates the reward pool token account owned by the vault authority PDA.
///
/// # Errors
///
/// Returns an error if the config PDA already exists (already initialized).
pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let config = &mut ctx.accounts.config;

    config.admin = ctx.accounts.admin.key();
    config.token_mint = ctx.accounts.token_mint.key();
    config.reward_pool_vault = ctx.accounts.reward_pool_vault.key();
    config.config_bump = ctx.bumps.config;
    config.vault_authority_bump = ctx.bumps.vault_authority;
    config.tier_thresholds = DEFAULT_TIER_THRESHOLDS;
    config.tier_apy_bps = DEFAULT_TIER_APY_BPS;
    config.cooldown_seconds = DEFAULT_COOLDOWN_SECONDS;
    config.total_staked = 0;
    config.total_rewards_distributed = 0;
    config.active_stakers = 0;
    config.paused = false;

    msg!("Staking program initialized by admin: {}", config.admin);
    Ok(())
}
