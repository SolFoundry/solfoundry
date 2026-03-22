//! Global staking configuration account.
//!
//! Stores protocol-wide parameters such as tier thresholds,
//! APY rates, cooldown duration, and the admin authority.
//! There is exactly one [`StakingConfig`] PDA per program deployment,
//! derived with seeds `["config"]`.

use anchor_lang::prelude::*;

/// Number of staking tiers supported by the program.
pub const NUM_TIERS: usize = 3;

/// Seven-day unbonding cooldown expressed in seconds.
pub const DEFAULT_COOLDOWN_SECONDS: i64 = 7 * 24 * 60 * 60;

/// Minimum amounts (in token base units) required for each tier.
///
/// Index 0 = Bronze, 1 = Silver, 2 = Gold.
pub const DEFAULT_TIER_THRESHOLDS: [u64; NUM_TIERS] = [
    10_000_000_000,  // Bronze:  10,000 $FNDRY (6 decimals)
    50_000_000_000,  // Silver:  50,000 $FNDRY
    100_000_000_000, // Gold:   100,000 $FNDRY
];

/// Annual percentage yield for each tier, expressed in basis points
/// (1 bp = 0.01%). For example 500 = 5.00% APY.
///
/// Index 0 = Bronze, 1 = Silver, 2 = Gold.
pub const DEFAULT_TIER_APY_BPS: [u16; NUM_TIERS] = [
    500,  // Bronze: 5.00%
    800,  // Silver: 8.00%
    1200, // Gold:  12.00%
];

/// Seconds in a 365-day year, used for reward calculation.
pub const SECONDS_PER_YEAR: u64 = 365 * 24 * 60 * 60;

/// Global staking configuration PDA.
///
/// Seeds: `["config"]`.
/// Holds admin authority, tier definitions, cooldown, and the
/// reward pool token account reference.
#[account]
#[derive(Debug)]
pub struct StakingConfig {
    /// The admin authority that can update config and execute slashes.
    pub admin: Pubkey,

    /// Token mint for $FNDRY.
    pub token_mint: Pubkey,

    /// The PDA-owned token account that holds reward pool funds.
    pub reward_pool_vault: Pubkey,

    /// Bump seed for the config PDA.
    pub config_bump: u8,

    /// Bump seed for the vault authority PDA.
    pub vault_authority_bump: u8,

    /// Minimum stake amounts for each tier (Bronze, Silver, Gold).
    pub tier_thresholds: [u64; NUM_TIERS],

    /// APY in basis points for each tier.
    pub tier_apy_bps: [u16; NUM_TIERS],

    /// Cooldown duration in seconds for unstaking.
    pub cooldown_seconds: i64,

    /// Total amount currently staked across all users.
    pub total_staked: u64,

    /// Total rewards distributed to date.
    pub total_rewards_distributed: u64,

    /// Number of active stake accounts.
    pub active_stakers: u64,

    /// Whether the staking program is paused (emergency stop).
    pub paused: bool,
}

impl StakingConfig {
    /// Space required for account allocation.
    ///
    /// 8 (discriminator) + 32 (admin) + 32 (token_mint) +
    /// 32 (reward_pool_vault) + 1 (config_bump) +
    /// 1 (vault_authority_bump) + 24 (tier_thresholds: 3*8) +
    /// 6 (tier_apy_bps: 3*2) + 8 (cooldown_seconds) +
    /// 8 (total_staked) + 8 (total_rewards_distributed) +
    /// 8 (active_stakers) + 1 (paused)
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 1 + 1 + 24 + 6 + 8 + 8 + 8 + 8 + 1;

    /// Returns the staking tier index (0=Bronze, 1=Silver, 2=Gold) for
    /// the given staked amount, or `None` if the amount is below the
    /// minimum Bronze threshold.
    pub fn tier_for_amount(&self, amount: u64) -> Option<u8> {
        let mut tier: Option<u8> = None;
        for (index, &threshold) in self.tier_thresholds.iter().enumerate() {
            if amount >= threshold {
                tier = Some(index as u8);
            }
        }
        tier
    }

    /// Returns the APY in basis points for the given staked amount.
    ///
    /// Falls back to the lowest tier APY if the amount qualifies for
    /// at least Bronze. Returns 0 if below all thresholds.
    pub fn apy_bps_for_amount(&self, amount: u64) -> u16 {
        match self.tier_for_amount(amount) {
            Some(tier_index) => self.tier_apy_bps[tier_index as usize],
            None => 0,
        }
    }
}

/// Human-readable tier names for logging and events.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum StakingTier {
    /// Minimum 10,000 $FNDRY — 5% APY.
    Bronze,
    /// Minimum 50,000 $FNDRY — 8% APY.
    Silver,
    /// Minimum 100,000 $FNDRY — 12% APY.
    Gold,
}

impl StakingTier {
    /// Converts a tier index (0, 1, 2) to the enum variant.
    pub fn from_index(index: u8) -> Option<Self> {
        match index {
            0 => Some(StakingTier::Bronze),
            1 => Some(StakingTier::Silver),
            2 => Some(StakingTier::Gold),
            _ => None,
        }
    }

    /// Returns the display name for the tier.
    pub fn name(&self) -> &'static str {
        match self {
            StakingTier::Bronze => "Bronze",
            StakingTier::Silver => "Silver",
            StakingTier::Gold => "Gold",
        }
    }
}
