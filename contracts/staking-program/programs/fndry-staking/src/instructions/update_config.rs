//! Admin-only configuration update instruction.
//!
//! Allows the admin to modify tier thresholds, APY rates, cooldown
//! duration, and the paused state without redeploying the program.

use anchor_lang::prelude::*;

use crate::errors::StakingError;
use crate::state::{StakingConfig, NUM_TIERS};

/// Accounts required for the `update_config` instruction.
#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    /// The admin authority.
    pub admin: Signer<'info>,

    /// Global staking configuration PDA.
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.config_bump,
        constraint = config.admin == admin.key() @ StakingError::Unauthorized,
    )]
    pub config: Account<'info, StakingConfig>,
}

/// Parameters for updating the staking configuration.
///
/// All fields are optional. Only provided (non-`None`) fields are applied.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ConfigUpdateParams {
    /// New tier thresholds (Bronze, Silver, Gold). Must be in ascending order.
    pub tier_thresholds: Option<[u64; NUM_TIERS]>,

    /// New APY rates in basis points for each tier.
    pub tier_apy_bps: Option<[u16; NUM_TIERS]>,

    /// New cooldown duration in seconds.
    pub cooldown_seconds: Option<i64>,

    /// Whether to pause or unpause the program.
    pub paused: Option<bool>,
}

/// Updates the staking configuration with the provided parameters.
///
/// # Arguments
///
/// * `ctx` - Instruction context with validated accounts.
/// * `params` - Configuration update parameters (only non-None fields are applied).
///
/// # Security
///
/// Only the admin authority recorded in the config PDA can call this.
///
/// # Validation
///
/// - Tier thresholds must be in strictly ascending order.
/// - APY values must be between 0 and 10,000 bps (0-100%).
/// - Cooldown must be non-negative.
///
/// # Errors
///
/// - [`StakingError::Unauthorized`] if caller is not the admin.
pub fn handler(ctx: Context<UpdateConfig>, params: ConfigUpdateParams) -> Result<()> {
    let config = &mut ctx.accounts.config;

    if let Some(thresholds) = params.tier_thresholds {
        // Validate ascending order.
        for i in 1..NUM_TIERS {
            require!(thresholds[i] > thresholds[i - 1], StakingError::Unauthorized);
        }
        config.tier_thresholds = thresholds;
        msg!("Updated tier thresholds");
    }

    if let Some(apy_bps) = params.tier_apy_bps {
        for &apy in &apy_bps {
            require!(apy <= 10_000, StakingError::Unauthorized);
        }
        config.tier_apy_bps = apy_bps;
        msg!("Updated tier APY rates");
    }

    if let Some(cooldown) = params.cooldown_seconds {
        require!(cooldown >= 0, StakingError::InvalidTimestamp);
        config.cooldown_seconds = cooldown;
        msg!("Updated cooldown to {} seconds", cooldown);
    }

    if let Some(paused) = params.paused {
        config.paused = paused;
        msg!("Program paused state set to: {}", paused);
    }

    Ok(())
}
