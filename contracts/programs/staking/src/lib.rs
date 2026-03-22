use anchor_lang::prelude::*;

// Placeholder ID — run `anchor build && anchor keys sync` to regenerate from keypair.
declare_id!("STKGnFTAiPsEHzaMqN2ySJzaDnFTiRwb3JXFb4yHwqPr");

#[program]
pub mod staking {
    use super::*;

    /// Creates a staking position PDA for a $FNDRY holder.
    /// Locked tokens boost the contributor's reputation multiplier.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account = &mut ctx.accounts.stake_account;
        account.staker = ctx.accounts.staker.key();
        account.bump = ctx.bumps.stake_account;
        account.amount_staked = 0;
        account.locked_until = 0;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = staker,
        space = StakeAccount::LEN,
        seeds = [b"stake", staker.key().as_ref()],
        bump,
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(mut)]
    pub staker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[account]
pub struct StakeAccount {
    /// The wallet that owns this stake position.
    pub staker: Pubkey,
    /// Amount of $FNDRY currently staked (in token base units).
    pub amount_staked: u64,
    /// Unix timestamp when tokens can be unstaked.
    pub locked_until: i64,
    /// PDA bump seed.
    pub bump: u8,
}

impl StakeAccount {
    // discriminator(8) + pubkey(32) + u64(8) + i64(8) + u8(1)
    const LEN: usize = 8 + 32 + 8 + 8 + 1;
}
