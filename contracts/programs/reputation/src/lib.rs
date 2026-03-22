use anchor_lang::prelude::*;

// Placeholder ID — run `anchor build && anchor keys sync` to regenerate from keypair.
declare_id!("RPTNzHXtmDSy7y7UoU3X3r56QQW3bRGSJhWKFpkXHmk");

#[program]
pub mod reputation {
    use super::*;

    /// Creates an on-chain reputation PDA for a contributor.
    /// Score is updated by the treasury program on each approved bounty.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account = &mut ctx.accounts.reputation_account;
        account.contributor = ctx.accounts.contributor.key();
        account.bump = ctx.bumps.reputation_account;
        account.score = 0;
        account.bounties_completed = 0;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = contributor,
        space = ReputationAccount::LEN,
        seeds = [b"reputation", contributor.key().as_ref()],
        bump,
    )]
    pub reputation_account: Account<'info, ReputationAccount>,

    #[account(mut)]
    pub contributor: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct ReputationAccount {
    /// The contributor this reputation record belongs to.
    pub contributor: Pubkey,
    /// Aggregate reputation score (0–100).
    pub score: u64,
    /// Lifetime count of approved bounties.
    pub bounties_completed: u64,
    /// PDA bump seed.
    pub bump: u8,
}

impl ReputationAccount {
    // discriminator(8) + pubkey(32) + u64(8) + u64(8) + u8(1)
    const LEN: usize = 8 + 32 + 8 + 8 + 1;
}
