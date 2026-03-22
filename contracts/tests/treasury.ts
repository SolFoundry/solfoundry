import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Treasury } from "../target/types/treasury";

describe("treasury", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Treasury as Program<Treasury>;

  let treasuryAccount: anchor.web3.PublicKey;
  let bump: number;

  before(async () => {
    [treasuryAccount, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );
  });

  it("initializes the treasury account", async () => {
    await program.methods
      .initialize()
      .accounts({
        treasuryAccount,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account =
      await program.account.treasuryAccount.fetch(treasuryAccount);
    assert.ok(
      account.authority.equals(provider.wallet.publicKey),
      "authority mismatch"
    );
    assert.equal(account.bump, bump, "bump mismatch");
    assert.equal(
      account.totalPaidOut.toNumber(),
      0,
      "initial total_paid_out should be 0"
    );
    assert.equal(
      account.totalBoughtBack.toNumber(),
      0,
      "initial total_bought_back should be 0"
    );
  });
});
