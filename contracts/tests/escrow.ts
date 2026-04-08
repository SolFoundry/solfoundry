import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { Escrow } from "../target/types/escrow";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Escrow as Program<Escrow>;

  let escrowAccount: anchor.web3.PublicKey;
  let bump: number;

  before(async () => {
    [escrowAccount, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("escrow"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );
  });

  it("initializes the escrow account", async () => {
    await program.methods
      .initialize()
      .accounts({
        escrowAccount,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = await program.account.escrowAccount.fetch(escrowAccount);
    assert.ok(
      account.authority.equals(provider.wallet.publicKey),
      "authority mismatch"
    );
    assert.equal(account.bump, bump, "bump mismatch");
    assert.equal(account.amount.toNumber(), 0, "initial amount should be 0");
    assert.equal(account.isActive, false, "should not be active on init");
  });
});
