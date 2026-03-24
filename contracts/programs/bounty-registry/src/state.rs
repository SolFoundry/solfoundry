//! On-chain account structures and enumerations for the bounty registry.
//!
//! The primary account type is [`BountyRecord`], derived as a PDA from
//! `["registry", bounty_id.to_le_bytes()]`. The [`BountyStatus`] enum
//! encodes the lifecycle state machine.

use anchor_lang::prelude::*;

/// Maximum length of a bounty title in bytes.
pub const MAX_TITLE_LENGTH: usize = 64;

/// Maximum length of a GitHub reference (issue URL or PR URL) in bytes.
pub const MAX_GITHUB_REF_LENGTH: usize = 128;

/// Number of review model scores stored per bounty.
pub const REVIEW_MODEL_COUNT: usize = 5;

/// The PDA seed prefix used for all bounty record accounts.
pub const REGISTRY_SEED: &[u8] = b"registry";

/// Lifecycle status of a bounty in the registry.
///
/// State machine transitions:
/// ```text
/// Open ──→ Claimed ──→ InReview ──→ Completed
///  │          │
///  └──→ Cancelled ←──┘
/// ```
///
/// Terminal states (Completed, Cancelled) allow no further transitions.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum BountyStatus {
    /// Bounty is open and available for claiming.
    Open = 0,
    /// A contributor has claimed the bounty and is working on it.
    Claimed = 1,
    /// The contributor's PR is under multi-LLM review.
    InReview = 2,
    /// The bounty has been completed and the PR merged (terminal).
    Completed = 3,
    /// The bounty has been cancelled (terminal).
    Cancelled = 4,
}

impl BountyStatus {
    /// Convert a raw `u8` value into a [`BountyStatus`].
    ///
    /// # Arguments
    ///
    /// * `value` – Integer representation of the status (0–4).
    ///
    /// # Returns
    ///
    /// `Some(BountyStatus)` if the value maps to a valid variant, `None` otherwise.
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(BountyStatus::Open),
            1 => Some(BountyStatus::Claimed),
            2 => Some(BountyStatus::InReview),
            3 => Some(BountyStatus::Completed),
            4 => Some(BountyStatus::Cancelled),
            _ => None,
        }
    }

    /// Check whether this status is a terminal state (no further transitions allowed).
    ///
    /// # Returns
    ///
    /// `true` if the status is `Completed` or `Cancelled`.
    pub fn is_terminal(&self) -> bool {
        matches!(self, BountyStatus::Completed | BountyStatus::Cancelled)
    }

    /// Validate whether a transition from `self` to `target` is permitted.
    ///
    /// # Arguments
    ///
    /// * `target` – The desired next status.
    ///
    /// # Returns
    ///
    /// `true` if the transition is valid according to the state machine.
    pub fn can_transition_to(&self, target: &BountyStatus) -> bool {
        matches!(
            (self, target),
            (BountyStatus::Open, BountyStatus::Claimed)
                | (BountyStatus::Open, BountyStatus::Cancelled)
                | (BountyStatus::Claimed, BountyStatus::InReview)
                | (BountyStatus::Claimed, BountyStatus::Cancelled)
                | (BountyStatus::InReview, BountyStatus::Completed)
        )
    }
}

/// On-chain bounty record stored as a PDA.
///
/// Seeds: `["registry", bounty_id.to_le_bytes()]`
///
/// This account holds all metadata about a single SolFoundry bounty:
/// its definition, current lifecycle status, contributor assignment,
/// review scores, and completion proof. It does NOT hold any funds.
///
/// ## Space Calculation
///
/// | Field             | Size (bytes)  |
/// |-------------------|---------------|
/// | discriminator     | 8             |
/// | bounty_id         | 8             |
/// | title             | 4 + 64        |
/// | tier              | 1             |
/// | reward_amount     | 8             |
/// | status            | 1             |
/// | creator           | 32            |
/// | contributor       | 1 + 32 = 33   |
/// | github_issue      | 4 + 128       |
/// | github_pr         | 4 + 128       |
/// | review_scores     | 4 + (5 × 2)   |
/// | final_score       | 2             |
/// | pr_hash           | 1 + 32 = 33   |
/// | created_at        | 8             |
/// | updated_at        | 8             |
/// | completed_at      | 1 + 8 = 9     |
/// | bump              | 1             |
/// | **Total**         | **531**       |
#[account]
#[derive(InitSpace)]
pub struct BountyRecord {
    /// Unique numeric identifier for this bounty.
    pub bounty_id: u64,

    /// Human-readable title of the bounty.
    #[max_len(64)]
    pub title: String,

    /// Bounty tier (1, 2, or 3). Determines review threshold and access.
    pub tier: u8,

    /// Reward amount in smallest token unit (metadata only, no custody).
    pub reward_amount: u64,

    /// Current lifecycle status of the bounty.
    pub status: BountyStatus,

    /// Public key of the admin who registered this bounty.
    pub creator: Pubkey,

    /// Public key of the contributor who claimed the bounty (if any).
    pub contributor: Option<Pubkey>,

    /// GitHub issue URL or identifier string.
    #[max_len(128)]
    pub github_issue: String,

    /// GitHub PR URL or identifier string (set on completion).
    #[max_len(128)]
    pub github_pr: String,

    /// Review scores from each of the five LLM models (0–1000 each,
    /// representing 0.0–10.0 with one decimal of precision).
    #[max_len(5)]
    pub review_scores: Vec<u16>,

    /// Final aggregated review score (0–1000).
    pub final_score: u16,

    /// SHA-256 hash of the merged PR diff (set on completion).
    pub pr_hash: Option<[u8; 32]>,

    /// Unix timestamp when the bounty was registered.
    pub created_at: i64,

    /// Unix timestamp of the last status update.
    pub updated_at: i64,

    /// Unix timestamp when the bounty was completed (if applicable).
    pub completed_at: Option<i64>,

    /// PDA bump seed for re-derivation.
    pub bump: u8,
}
