import { Connection, Keypair } from '@solana/web3.js';
import { Wallet, BN } from '@coral-xyz/anchor';
import { BountyRegistryClient, StakingClient } from '../src/programs/index.js';

async function main() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const keypair = Keypair.generate();
  const wallet = new Wallet(keypair);

  // Initialize the Bounty Registry client
  const bountyClient = new BountyRegistryClient({ connection, wallet });
  console.log('Bounty Registry program ID:', bountyClient.programId.toBase58());

  // Derive a bounty record PDA
  const bountyId = new BN(1);
  const [bountyPDA] = BountyRegistryClient.deriveBountyRecordPDA(bountyId);
  console.log('Bounty record PDA:', bountyPDA.toBase58());

  // Initialize the Staking client
  const stakingClient = new StakingClient({ connection, wallet });
  console.log('Staking program ID:', stakingClient.programId.toBase58());

  // Derive staking PDAs
  const [configPDA] = StakingClient.deriveConfigPDA();
  const [stakeAccountPDA] = StakingClient.deriveStakeAccountPDA(keypair.publicKey);
  console.log('Config PDA:', configPDA.toBase58());
  console.log('Stake account PDA:', stakeAccountPDA.toBase58());
}

main().catch(console.error);
