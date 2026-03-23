import * as anchor from "@coral-xyz/anchor";

// This migration runs once when programs are first deployed.
// Add one-time setup instructions here (e.g. initializing the treasury PDA).
module.exports = async function (provider: anchor.AnchorProvider) {
  anchor.setProvider(provider);
};
