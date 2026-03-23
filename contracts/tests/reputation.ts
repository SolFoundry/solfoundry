import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Reputation } from "../target/types/reputation";

describe("reputation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Reputation as Program<Reputation>;

  let reputationAccount: anchor.web3.PublicKey;
  let bump: number;

  before(async () => {
    [reputationAccount, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("initializes the reputation account", async () => {
    await program.methods
      .initialize()
      .accounts({
        reputationAccount,
        contributor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account =
      await program.account.reputationAccount.fetch(reputationAccount);
    assert.ok(
      account.contributor.equals(provider.wallet.publicKey),
      "contributor mismatch"
    );
    assert.equal(account.bump, bump, "bump mismatch");
    assert.equal(account.score.toNumber(), 0, "initial score should be 0");
    assert.equal(
      account.bountiesCompleted.toNumber(),
      0,
      "initial bounties_completed should be 0"
    );
  });
});
