//! CPI events emitted by the bounty registry program.
//!
//! Every state change emits a corresponding event so that off-chain
//! indexers (e.g., Helius, Yellowstone) can track bounty lifecycle
//! transitions in real time.

use anchor_lang::prelude::*;

/// Emitted when a new bounty is registered in the registry.
///
/// Contains all initial metadata for the bounty record.
#[event]
pub struct BountyRegistered {
    /// Unique bounty identifier.
    pub bounty_id: u64,
    /// Human-readable title.
    pub title: String,
    /// Bounty tier (1, 2, or 3).
    pub tier: u8,
    /// Reward amount in smallest token unit.
    pub reward_amount: u64,
    /// GitHub issue reference.
    pub github_issue: String,
    /// Admin who registered the bounty.
    pub creator: Pubkey,
    /// Unix timestamp of registration.
    pub created_at: i64,
}

/// Emitted when a bounty's status changes.
///
/// Captures both the previous and new status for indexer delta tracking.
#[event]
pub struct BountyStatusUpdated {
    /// Unique bounty identifier.
    pub bounty_id: u64,
    /// Status before the transition.
    pub previous_status: u8,
    /// Status after the transition.
    pub new_status: u8,
    /// Contributor pubkey (populated when transitioning to Claimed).
    pub contributor: Option<Pubkey>,
    /// Unix timestamp of the status change.
    pub updated_at: i64,
}

/// Emitted when completion details are recorded for a bounty.
///
/// Contains the review pipeline results and on-chain proof of the merged PR.
#[event]
pub struct BountyCompleted {
    /// Unique bounty identifier.
    pub bounty_id: u64,
    /// GitHub PR reference.
    pub github_pr: String,
    /// Individual scores from each of the five review models.
    pub review_scores: Vec<u16>,
    /// Aggregated final score.
    pub final_score: u16,
    /// SHA-256 hash of the merged PR diff.
    pub pr_hash: [u8; 32],
    /// Contributor who completed the bounty.
    pub contributor: Option<Pubkey>,
    /// Unix timestamp of completion.
    pub completed_at: i64,
}

/// Emitted when a bounty is cancelled (closed without completion).
#[event]
pub struct BountyClosed {
    /// Unique bounty identifier.
    pub bounty_id: u64,
    /// Status before closure (Open or Claimed).
    pub previous_status: u8,
    /// Unix timestamp of cancellation.
    pub closed_at: i64,
}
