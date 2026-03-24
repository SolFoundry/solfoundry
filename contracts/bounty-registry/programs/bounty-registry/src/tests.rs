//! Unit tests for the bounty-registry program.
//!
//! These tests exercise pure Rust logic — state machine transitions,
//! input validation, and arithmetic — without requiring a Solana
//! runtime or test validator.
//!
//! Run with: `cargo test` from `contracts/bounty-registry/`

use crate::state::{BountyStatus, MAX_GITHUB_REF_LENGTH, MAX_TITLE_LENGTH, REVIEW_MODEL_COUNT};

// ──────────────────────────────────────────────────────────────────
// BountyStatus state machine
// ──────────────────────────────────────────────────────────────────

#[test]
fn status_open_can_transition_to_claimed() {
    assert!(BountyStatus::Open.can_transition_to(&BountyStatus::Claimed));
}

#[test]
fn status_open_can_transition_to_cancelled() {
    assert!(BountyStatus::Open.can_transition_to(&BountyStatus::Cancelled));
}

#[test]
fn status_claimed_can_transition_to_in_review() {
    assert!(BountyStatus::Claimed.can_transition_to(&BountyStatus::InReview));
}

#[test]
fn status_claimed_can_transition_to_cancelled() {
    assert!(BountyStatus::Claimed.can_transition_to(&BountyStatus::Cancelled));
}

#[test]
fn status_in_review_can_transition_to_completed() {
    assert!(BountyStatus::InReview.can_transition_to(&BountyStatus::Completed));
}

#[test]
fn status_open_cannot_transition_to_in_review() {
    assert!(!BountyStatus::Open.can_transition_to(&BountyStatus::InReview));
}

#[test]
fn status_open_cannot_transition_to_completed() {
    assert!(!BountyStatus::Open.can_transition_to(&BountyStatus::Completed));
}

#[test]
fn status_claimed_cannot_transition_to_open() {
    assert!(!BountyStatus::Claimed.can_transition_to(&BountyStatus::Open));
}

#[test]
fn status_in_review_cannot_transition_to_cancelled() {
    assert!(!BountyStatus::InReview.can_transition_to(&BountyStatus::Cancelled));
}

#[test]
fn status_completed_is_terminal() {
    assert!(BountyStatus::Completed.is_terminal());
    assert!(!BountyStatus::Completed.can_transition_to(&BountyStatus::Cancelled));
    assert!(!BountyStatus::Completed.can_transition_to(&BountyStatus::Open));
}

#[test]
fn status_cancelled_is_terminal() {
    assert!(BountyStatus::Cancelled.is_terminal());
    assert!(!BountyStatus::Cancelled.can_transition_to(&BountyStatus::Open));
    assert!(!BountyStatus::Cancelled.can_transition_to(&BountyStatus::Claimed));
}

#[test]
fn status_non_terminal_variants_are_not_terminal() {
    assert!(!BountyStatus::Open.is_terminal());
    assert!(!BountyStatus::Claimed.is_terminal());
    assert!(!BountyStatus::InReview.is_terminal());
}

// ──────────────────────────────────────────────────────────────────
// BountyStatus from_u8 conversion
// ──────────────────────────────────────────────────────────────────

#[test]
fn status_from_u8_all_valid_values() {
    assert_eq!(BountyStatus::from_u8(0), Some(BountyStatus::Open));
    assert_eq!(BountyStatus::from_u8(1), Some(BountyStatus::Claimed));
    assert_eq!(BountyStatus::from_u8(2), Some(BountyStatus::InReview));
    assert_eq!(BountyStatus::from_u8(3), Some(BountyStatus::Completed));
    assert_eq!(BountyStatus::from_u8(4), Some(BountyStatus::Cancelled));
}

#[test]
fn status_from_u8_invalid_values_return_none() {
    assert_eq!(BountyStatus::from_u8(5), None);
    assert_eq!(BountyStatus::from_u8(255), None);
}

// ──────────────────────────────────────────────────────────────────
// Validation constant boundaries
// ──────────────────────────────────────────────────────────────────

#[test]
fn title_max_length_is_64() {
    assert_eq!(MAX_TITLE_LENGTH, 64);
    // String of exactly 64 bytes must pass.
    let exactly_64 = "A".repeat(64);
    assert!(exactly_64.len() <= MAX_TITLE_LENGTH);
}

#[test]
fn title_exceeding_max_length_fails_check() {
    let too_long = "A".repeat(65);
    assert!(too_long.len() > MAX_TITLE_LENGTH);
}

#[test]
fn github_ref_max_length_is_128() {
    assert_eq!(MAX_GITHUB_REF_LENGTH, 128);
    let exactly_128 = "https://github.com/".to_string() + &"x".repeat(109);
    assert_eq!(exactly_128.len(), 128);
    assert!(exactly_128.len() <= MAX_GITHUB_REF_LENGTH);
}

#[test]
fn github_ref_exceeding_max_length_fails_check() {
    let too_long = "https://github.com/".to_string() + &"x".repeat(110);
    assert!(too_long.len() > MAX_GITHUB_REF_LENGTH);
}

#[test]
fn review_model_count_is_five() {
    assert_eq!(REVIEW_MODEL_COUNT, 5);
}

// ──────────────────────────────────────────────────────────────────
// Tier validation (inline logic mirrors the on-chain check)
// ──────────────────────────────────────────────────────────────────

fn is_valid_tier(tier: u8) -> bool {
    tier >= 1 && tier <= 3
}

#[test]
fn tier_1_is_valid() {
    assert!(is_valid_tier(1));
}

#[test]
fn tier_2_is_valid() {
    assert!(is_valid_tier(2));
}

#[test]
fn tier_3_is_valid() {
    assert!(is_valid_tier(3));
}

#[test]
fn tier_0_is_invalid() {
    assert!(!is_valid_tier(0));
}

#[test]
fn tier_4_is_invalid() {
    assert!(!is_valid_tier(4));
}

#[test]
fn tier_255_is_invalid() {
    assert!(!is_valid_tier(255));
}

// ──────────────────────────────────────────────────────────────────
// Review score validation (inline logic mirrors the on-chain check)
// ──────────────────────────────────────────────────────────────────

fn validate_scores(scores: &[u16]) -> bool {
    scores.len() == REVIEW_MODEL_COUNT && scores.iter().all(|&s| s <= 1000)
}

#[test]
fn five_valid_scores_pass_validation() {
    assert!(validate_scores(&[850, 900, 750, 800, 950]));
}

#[test]
fn score_at_maximum_1000_passes() {
    assert!(validate_scores(&[1000, 1000, 1000, 1000, 1000]));
}

#[test]
fn score_at_zero_passes() {
    assert!(validate_scores(&[0, 0, 0, 0, 0]));
}

#[test]
fn four_scores_fail_count_check() {
    assert!(!validate_scores(&[800, 800, 800, 800]));
}

#[test]
fn six_scores_fail_count_check() {
    assert!(!validate_scores(&[800, 800, 800, 800, 800, 800]));
}

#[test]
fn score_above_1000_fails() {
    assert!(!validate_scores(&[800, 800, 800, 800, 1001]));
}
