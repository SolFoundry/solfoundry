import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Staking } from "../target/types/staking";

describe("staking", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Staking as Program<Staking>;

  let stakeAccount: anchor.web3.PublicKey;
  let bump: number;

  before(async () => {
    [stakeAccount, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("initializes the stake account", async () => {
    await program.methods
      .initialize()
      .accounts({
        stakeAccount,
        staker: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.stakeAccount.fetch(stakeAccount);
    assert.ok(
      account.staker.equals(provider.wallet.publicKey),
      "staker mismatch"
    );
    assert.equal(account.bump, bump, "bump mismatch");
    assert.equal(
      account.amountStaked.toNumber(),
      0,
      "initial amount_staked should be 0"
    );
    assert.equal(
      account.lockedUntil.toNumber(),
      0,
      "initial locked_until should be 0"
    );
  });
});
