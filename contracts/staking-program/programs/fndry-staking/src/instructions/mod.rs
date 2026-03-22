//! Instruction handlers for the FNDRY staking program.
//!
//! Each sub-module implements one instruction's account validation
//! (via Anchor `#[derive(Accounts)]`) and handler logic.

pub mod initialize;
pub mod stake;
pub mod unstake_initiate;
pub mod unstake_complete;
pub mod claim_rewards;
pub mod compound;
pub mod slash;
pub mod toggle_auto_compound;
pub mod update_config;

pub use initialize::*;
pub use stake::*;
pub use unstake_initiate::*;
pub use unstake_complete::*;
pub use claim_rewards::*;
pub use compound::*;
pub use slash::*;
pub use toggle_auto_compound::*;
pub use update_config::*;
