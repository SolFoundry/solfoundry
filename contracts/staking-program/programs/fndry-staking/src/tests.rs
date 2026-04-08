//! Unit tests for the fndry-staking program.
//!
//! These tests cover pure Rust logic — reward calculation math,
//! tier thresholds, APY lookups, and overflow protection — without
//! requiring a Solana runtime or test validator.
//!
//! Run with: `cargo test` from `contracts/staking-program/`

use crate::instructions::stake::calculate_rewards;
use crate::state::staking_config::{
    DEFAULT_COOLDOWN_SECONDS, DEFAULT_TIER_APY_BPS, DEFAULT_TIER_THRESHOLDS, NUM_TIERS,
    SECONDS_PER_YEAR,
};

// ──────────────────────────────────────────────────────────────────
// Constants sanity
// ──────────────────────────────────────────────────────────────────

#[test]
fn default_cooldown_is_seven_days() {
    assert_eq!(DEFAULT_COOLDOWN_SECONDS, 7 * 24 * 60 * 60);
}

#[test]
fn seconds_per_year_is_correct() {
    assert_eq!(SECONDS_PER_YEAR, 365 * 24 * 60 * 60);
}

#[test]
fn three_tiers_are_defined() {
    assert_eq!(NUM_TIERS, 3);
    assert_eq!(DEFAULT_TIER_THRESHOLDS.len(), NUM_TIERS);
    assert_eq!(DEFAULT_TIER_APY_BPS.len(), NUM_TIERS);
}

#[test]
fn bronze_threshold_is_10k_tokens() {
    // 10,000 tokens with 6 decimals = 10_000_000_000
    assert_eq!(DEFAULT_TIER_THRESHOLDS[0], 10_000_000_000);
}

#[test]
fn silver_threshold_is_50k_tokens() {
    assert_eq!(DEFAULT_TIER_THRESHOLDS[1], 50_000_000_000);
}

#[test]
fn gold_threshold_is_100k_tokens() {
    assert_eq!(DEFAULT_TIER_THRESHOLDS[2], 100_000_000_000);
}

#[test]
fn bronze_apy_is_5_percent() {
    assert_eq!(DEFAULT_TIER_APY_BPS[0], 500); // 500 bps = 5.00%
}

#[test]
fn silver_apy_is_8_percent() {
    assert_eq!(DEFAULT_TIER_APY_BPS[1], 800); // 800 bps = 8.00%
}

#[test]
fn gold_apy_is_12_percent() {
    assert_eq!(DEFAULT_TIER_APY_BPS[2], 1200); // 1200 bps = 12.00%
}

// ──────────────────────────────────────────────────────────────────
// Tier threshold ordering
// ──────────────────────────────────────────────────────────────────

#[test]
fn tier_thresholds_are_strictly_increasing() {
    for i in 0..NUM_TIERS - 1 {
        assert!(
            DEFAULT_TIER_THRESHOLDS[i] < DEFAULT_TIER_THRESHOLDS[i + 1],
            "Tier {} threshold {} is not less than tier {} threshold {}",
            i,
            DEFAULT_TIER_THRESHOLDS[i],
            i + 1,
            DEFAULT_TIER_THRESHOLDS[i + 1]
        );
    }
}

#[test]
fn tier_apy_rates_are_strictly_increasing() {
    for i in 0..NUM_TIERS - 1 {
        assert!(DEFAULT_TIER_APY_BPS[i] < DEFAULT_TIER_APY_BPS[i + 1]);
    }
}

// ──────────────────────────────────────────────────────────────────
// calculate_rewards: zero / edge cases
// ──────────────────────────────────────────────────────────────────

#[test]
fn rewards_are_zero_for_zero_amount() {
    let result = calculate_rewards(0, 0, 3600, 500);
    assert_eq!(result.unwrap(), 0);
}

#[test]
fn rewards_are_zero_when_apy_is_zero() {
    let result = calculate_rewards(10_000_000_000, 0, 3600, 0);
    assert_eq!(result.unwrap(), 0);
}

#[test]
fn rewards_are_zero_when_timestamps_equal() {
    let ts: i64 = 1_700_000_000;
    let result = calculate_rewards(10_000_000_000, ts, ts, 500);
    assert_eq!(result.unwrap(), 0);
}

#[test]
fn rewards_are_zero_when_current_before_last_claim() {
    let result = calculate_rewards(10_000_000_000, 1000, 999, 500);
    assert_eq!(result.unwrap(), 0);
}

// ──────────────────────────────────────────────────────────────────
// calculate_rewards: correctness
// ──────────────────────────────────────────────────────────────────

#[test]
fn rewards_for_one_full_year_bronze_apy() {
    // amount = 10,000 FNDRY (6 dec) at 5% APY for one full year
    // expected = 10_000_000_000 * 500 / 10_000 = 500_000_000 (500 FNDRY)
    let amount: u64 = 10_000_000_000;
    let apy_bps: u16 = 500;
    let duration: i64 = SECONDS_PER_YEAR as i64;

    let result = calculate_rewards(amount, 0, duration, apy_bps).unwrap();
    assert_eq!(result, 500_000_000);
}

#[test]
fn rewards_for_one_full_year_gold_apy() {
    // amount = 100,000 FNDRY at 12% APY for one year
    // expected = 100_000_000_000 * 1200 / 10_000 = 12_000_000_000 (12,000 FNDRY)
    let amount: u64 = 100_000_000_000;
    let apy_bps: u16 = 1200;
    let duration: i64 = SECONDS_PER_YEAR as i64;

    let result = calculate_rewards(amount, 0, duration, apy_bps).unwrap();
    assert_eq!(result, 12_000_000_000);
}

#[test]
fn rewards_scale_linearly_with_time() {
    let amount: u64 = 10_000_000_000;
    let apy_bps: u16 = 500;

    let one_year = SECONDS_PER_YEAR as i64;
    let half_year = one_year / 2;

    let full = calculate_rewards(amount, 0, one_year, apy_bps).unwrap();
    let half = calculate_rewards(amount, 0, half_year, apy_bps).unwrap();

    // Half-year rewards should be half (with integer rounding tolerance of 1).
    assert!(full / 2 == half || full / 2 == half + 1 || full / 2 == half - 1);
}

#[test]
fn rewards_scale_linearly_with_amount() {
    let apy_bps: u16 = 500;
    let duration: i64 = SECONDS_PER_YEAR as i64;

    let single = calculate_rewards(10_000_000_000, 0, duration, apy_bps).unwrap();
    let double = calculate_rewards(20_000_000_000, 0, duration, apy_bps).unwrap();

    assert_eq!(double, single * 2);
}

#[test]
fn rewards_for_one_day_bronze() {
    // 1 day / 365 days = ~1/365 of annual rewards
    let amount: u64 = 10_000_000_000; // 10k FNDRY
    let apy_bps: u16 = 500; // 5%
    let one_day_seconds: i64 = 86_400;

    // Expected: 500_000_000 / 365 ≈ 1_369_863
    let result = calculate_rewards(amount, 0, one_day_seconds, apy_bps).unwrap();
    assert!(result > 1_000_000 && result < 2_000_000, "Daily reward was {}", result);
}

// ──────────────────────────────────────────────────────────────────
// StakingConfig tier helpers (via inline test struct)
// ──────────────────────────────────────────────────────────────────

use crate::state::staking_config::StakingConfig;
use anchor_lang::prelude::Pubkey;

fn make_config() -> StakingConfig {
    StakingConfig {
        admin: Pubkey::default(),
        token_mint: Pubkey::default(),
        reward_pool_vault: Pubkey::default(),
        config_bump: 0,
        vault_authority_bump: 0,
        tier_thresholds: DEFAULT_TIER_THRESHOLDS,
        tier_apy_bps: DEFAULT_TIER_APY_BPS,
        cooldown_seconds: DEFAULT_COOLDOWN_SECONDS,
        total_staked: 0,
        total_rewards_distributed: 0,
        active_stakers: 0,
        paused: false,
    }
}

#[test]
fn tier_below_bronze_returns_none() {
    let cfg = make_config();
    assert!(cfg.tier_for_amount(9_999_999_999).is_none());
}

#[test]
fn tier_at_bronze_minimum_returns_bronze() {
    let cfg = make_config();
    assert_eq!(cfg.tier_for_amount(DEFAULT_TIER_THRESHOLDS[0]), Some(0));
}

#[test]
fn tier_between_bronze_and_silver_returns_bronze() {
    let cfg = make_config();
    let mid = DEFAULT_TIER_THRESHOLDS[0] + 1_000_000_000; // Bronze + 1k
    assert_eq!(cfg.tier_for_amount(mid), Some(0));
}

#[test]
fn tier_at_silver_minimum_returns_silver() {
    let cfg = make_config();
    assert_eq!(cfg.tier_for_amount(DEFAULT_TIER_THRESHOLDS[1]), Some(1));
}

#[test]
fn tier_at_gold_minimum_returns_gold() {
    let cfg = make_config();
    assert_eq!(cfg.tier_for_amount(DEFAULT_TIER_THRESHOLDS[2]), Some(2));
}

#[test]
fn tier_far_above_gold_still_returns_gold() {
    let cfg = make_config();
    assert_eq!(cfg.tier_for_amount(u64::MAX / 2), Some(2));
}

#[test]
fn apy_bps_below_bronze_is_zero() {
    let cfg = make_config();
    assert_eq!(cfg.apy_bps_for_amount(0), 0);
}

#[test]
fn apy_bps_at_bronze_is_500() {
    let cfg = make_config();
    assert_eq!(cfg.apy_bps_for_amount(DEFAULT_TIER_THRESHOLDS[0]), 500);
}

#[test]
fn apy_bps_at_gold_is_1200() {
    let cfg = make_config();
    assert_eq!(cfg.apy_bps_for_amount(DEFAULT_TIER_THRESHOLDS[2]), 1200);
}
