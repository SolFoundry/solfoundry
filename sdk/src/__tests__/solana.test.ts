/**
 * Tests for Solana blockchain helper functions.
 *
 * Validates PDA derivation, amount conversion, address validation,
 * transaction building, and connection creation utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FNDRY_TOKEN_MINT,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TREASURY_WALLET,
  DEFAULT_RPC_ENDPOINT,
  FNDRY_DECIMALS,
  findAssociatedTokenAddress,
  findProgramAddress,
  findEscrowAddress,
  findReputationAddress,
  getSolBalance,
  getTokenBalance,
  buildTokenTransferInstruction,
  buildTokenTransferTransaction,
  createConnection,
  isValidSolanaAddress,
  toRawAmount,
  toUiAmount,
} from '../solana.js';
import { PublicKey, Connection, Transaction } from '@solana/web3.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Solana constants', () => {
  it('should export correct FNDRY token mint', () => {
    expect(FNDRY_TOKEN_MINT.toBase58()).toBe('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS');
  });

  it('should export correct TOKEN_PROGRAM_ID', () => {
    expect(TOKEN_PROGRAM_ID.toBase58()).toBe('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  });

  it('should export correct ASSOCIATED_TOKEN_PROGRAM_ID', () => {
    expect(ASSOCIATED_TOKEN_PROGRAM_ID.toBase58()).toBe(
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
    );
  });

  it('should export correct TREASURY_WALLET', () => {
    expect(TREASURY_WALLET.toBase58()).toBe('57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp');
  });

  it('should export correct DEFAULT_RPC_ENDPOINT', () => {
    expect(DEFAULT_RPC_ENDPOINT).toBe('https://api.mainnet-beta.solana.com');
  });

  it('should export FNDRY_DECIMALS as 9', () => {
    expect(FNDRY_DECIMALS).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// PDA derivation
// ---------------------------------------------------------------------------

describe('findAssociatedTokenAddress', () => {
  it('should derive a valid ATA for a given wallet and mint', async () => {
    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const [ata, bump] = await findAssociatedTokenAddress(wallet);

    expect(ata).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it('should use FNDRY mint by default', async () => {
    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const [ata1] = await findAssociatedTokenAddress(wallet);
    const [ata2] = await findAssociatedTokenAddress(wallet, FNDRY_TOKEN_MINT);
    expect(ata1.toBase58()).toBe(ata2.toBase58());
  });

  it('should derive different ATAs for different mints', async () => {
    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const otherMint = new PublicKey('So11111111111111111111111111111111111111112');
    const [ata1] = await findAssociatedTokenAddress(wallet, FNDRY_TOKEN_MINT);
    const [ata2] = await findAssociatedTokenAddress(wallet, otherMint);
    expect(ata1.toBase58()).not.toBe(ata2.toBase58());
  });
});

describe('findProgramAddress', () => {
  it('should derive a PDA from arbitrary seeds', async () => {
    const programId = new PublicKey('11111111111111111111111111111111');
    const seeds = [Buffer.from('test'), Buffer.from('seed')];
    const [pda, bump] = await findProgramAddress(seeds, programId);

    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });
});

describe('findEscrowAddress', () => {
  it('should derive an escrow PDA from bounty ID', async () => {
    const programId = new PublicKey('11111111111111111111111111111111');
    const [pda, bump] = await findEscrowAddress('bounty-uuid-123', programId);

    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
  });

  it('should produce different addresses for different bounty IDs', async () => {
    const programId = new PublicKey('11111111111111111111111111111111');
    const [pda1] = await findEscrowAddress('bounty-1', programId);
    const [pda2] = await findEscrowAddress('bounty-2', programId);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });
});

describe('findReputationAddress', () => {
  it('should derive a reputation PDA from wallet', async () => {
    const programId = new PublicKey('11111111111111111111111111111111');
    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const [pda, bump] = await findReputationAddress(wallet, programId);

    expect(pda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Balance queries (mocked)
// ---------------------------------------------------------------------------

describe('getSolBalance', () => {
  it('should return SOL balance in both SOL and lamports', async () => {
    const mockConnection = {
      getBalance: vi.fn().mockResolvedValue(5_000_000_000), // 5 SOL
    } as unknown as Connection;

    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const balance = await getSolBalance(mockConnection, wallet);

    expect(balance.wallet).toBe('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    expect(balance.balanceSol).toBe(5);
    expect(balance.balanceLamports).toBe(5_000_000_000);
  });

  it('should handle zero balance', async () => {
    const mockConnection = {
      getBalance: vi.fn().mockResolvedValue(0),
    } as unknown as Connection;

    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const balance = await getSolBalance(mockConnection, wallet);

    expect(balance.balanceSol).toBe(0);
    expect(balance.balanceLamports).toBe(0);
  });
});

describe('getTokenBalance', () => {
  it('should return token balance with parsed data', async () => {
    const mockConnection = {
      getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({
        value: [
          {
            account: {
              data: {
                parsed: {
                  info: {
                    tokenAmount: {
                      uiAmount: 1500.5,
                      amount: '1500500000000',
                      decimals: 9,
                    },
                  },
                },
              },
            },
          },
        ],
      }),
    } as unknown as Connection;

    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const balance = await getTokenBalance(mockConnection, wallet);

    expect(balance.wallet).toBe('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    expect(balance.mint).toBe(FNDRY_TOKEN_MINT.toBase58());
    expect(balance.balance).toBe(1500.5);
    expect(balance.rawBalance).toBe('1500500000000');
    expect(balance.decimals).toBe(9);
  });

  it('should return zero when no token accounts exist', async () => {
    const mockConnection = {
      getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({ value: [] }),
    } as unknown as Connection;

    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const balance = await getTokenBalance(mockConnection, wallet);

    expect(balance.balance).toBe(0);
    expect(balance.rawBalance).toBe('0');
  });

  it('should sum balances from multiple token accounts', async () => {
    const mockConnection = {
      getParsedTokenAccountsByOwner: vi.fn().mockResolvedValue({
        value: [
          {
            account: {
              data: {
                parsed: {
                  info: {
                    tokenAmount: {
                      uiAmount: 100,
                      amount: '100000000000',
                      decimals: 9,
                    },
                  },
                },
              },
            },
          },
          {
            account: {
              data: {
                parsed: {
                  info: {
                    tokenAmount: {
                      uiAmount: 200,
                      amount: '200000000000',
                      decimals: 9,
                    },
                  },
                },
              },
            },
          },
        ],
      }),
    } as unknown as Connection;

    const wallet = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const balance = await getTokenBalance(mockConnection, wallet);

    expect(balance.balance).toBe(300);
    expect(balance.rawBalance).toBe('300000000000');
  });
});

// ---------------------------------------------------------------------------
// Transaction building
// ---------------------------------------------------------------------------

describe('buildTokenTransferInstruction', () => {
  it('should create a valid SPL transfer instruction', () => {
    const source = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const destination = new PublicKey('57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp');
    const authority = source;
    const amount = BigInt(1_000_000_000); // 1 FNDRY

    const instruction = buildTokenTransferInstruction(source, destination, authority, amount);

    expect(instruction.keys).toHaveLength(3);
    expect(instruction.keys[0].pubkey.toBase58()).toBe(source.toBase58());
    expect(instruction.keys[0].isWritable).toBe(true);
    expect(instruction.keys[1].pubkey.toBase58()).toBe(destination.toBase58());
    expect(instruction.keys[1].isWritable).toBe(true);
    expect(instruction.keys[2].pubkey.toBase58()).toBe(authority.toBase58());
    expect(instruction.keys[2].isSigner).toBe(true);
    expect(instruction.programId.toBase58()).toBe(TOKEN_PROGRAM_ID.toBase58());
    expect(instruction.data[0]).toBe(3); // Transfer instruction index
  });

  it('should encode the amount correctly in LE u64', () => {
    const source = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const destination = new PublicKey('57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp');
    const amount = BigInt(500_000_000_000); // 500 FNDRY

    const instruction = buildTokenTransferInstruction(source, destination, source, amount);

    // Read back the u64 LE from bytes 1-8
    const buffer = Buffer.from(instruction.data);
    const readAmount = buffer.readBigUInt64LE(1);
    expect(readAmount).toBe(amount);
  });
});

describe('buildTokenTransferTransaction', () => {
  it('should create an unsigned transaction with blockhash and fee payer', async () => {
    const mockConnection = {
      getLatestBlockhash: vi.fn().mockResolvedValue({
        blockhash: 'mock-blockhash-abc123',
        lastValidBlockHeight: 12345,
      }),
    } as unknown as Connection;

    const source = new PublicKey('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF');
    const destination = new PublicKey('57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp');
    const amount = BigInt(1_000_000_000);

    const tx = await buildTokenTransferTransaction(
      mockConnection,
      source,
      destination,
      source,
      amount,
    );

    expect(tx).toBeInstanceOf(Transaction);
    expect(tx.recentBlockhash).toBe('mock-blockhash-abc123');
    expect(tx.feePayer?.toBase58()).toBe(source.toBase58());
    expect(tx.instructions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

describe('createConnection', () => {
  it('should create a Connection with default endpoint', () => {
    const conn = createConnection();
    expect(conn).toBeInstanceOf(Connection);
  });

  it('should create a Connection with custom endpoint', () => {
    const conn = createConnection('https://custom-rpc.example.com');
    expect(conn).toBeInstanceOf(Connection);
  });

  it('should accept commitment level', () => {
    const conn = createConnection(undefined, 'finalized');
    expect(conn).toBeInstanceOf(Connection);
  });
});

// ---------------------------------------------------------------------------
// Address validation
// ---------------------------------------------------------------------------

describe('isValidSolanaAddress', () => {
  it('should return true for valid base58 addresses', () => {
    expect(isValidSolanaAddress('97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF')).toBe(true);
    expect(isValidSolanaAddress('57uMiMHnRJCxM7Q1MdGVMLsEtxzRiy1F6qKFWyP1S9pp')).toBe(true);
    expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true);
  });

  it('should return false for invalid addresses', () => {
    expect(isValidSolanaAddress('')).toBe(false);
    expect(isValidSolanaAddress('not-a-valid-address!')).toBe(false);
    expect(isValidSolanaAddress('0x1234567890abcdef')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Amount conversion
// ---------------------------------------------------------------------------

describe('toRawAmount', () => {
  it('should convert 1.0 FNDRY to 1_000_000_000 raw', () => {
    expect(toRawAmount(1.0)).toBe(BigInt(1_000_000_000));
  });

  it('should convert 0.5 FNDRY to 500_000_000 raw', () => {
    expect(toRawAmount(0.5)).toBe(BigInt(500_000_000));
  });

  it('should handle zero', () => {
    expect(toRawAmount(0)).toBe(BigInt(0));
  });

  it('should handle custom decimals', () => {
    expect(toRawAmount(1.0, 6)).toBe(BigInt(1_000_000));
  });
});

describe('toUiAmount', () => {
  it('should convert 1_000_000_000 raw to 1.0 FNDRY', () => {
    expect(toUiAmount(BigInt(1_000_000_000))).toBe(1.0);
  });

  it('should convert 500_000_000 raw to 0.5 FNDRY', () => {
    expect(toUiAmount(BigInt(500_000_000))).toBe(0.5);
  });

  it('should handle string input', () => {
    expect(toUiAmount('1000000000')).toBe(1.0);
  });

  it('should handle zero', () => {
    expect(toUiAmount(BigInt(0))).toBe(0);
  });

  it('should handle custom decimals', () => {
    expect(toUiAmount(BigInt(1_000_000), 6)).toBe(1.0);
  });
});
