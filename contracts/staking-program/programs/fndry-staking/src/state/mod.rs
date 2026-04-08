//! Account state definitions for the FNDRY staking program.
//!
//! This module defines the on-chain account structures used to track
//! individual stakes, the global staking configuration, and the
//! reward pool metadata.

pub mod stake_account;
pub mod staking_config;

pub use stake_account::*;
pub use staking_config::*;
