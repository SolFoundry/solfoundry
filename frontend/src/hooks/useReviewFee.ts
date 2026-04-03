/**
 * useReviewFee — Fetch review fee info and handle $FNDRY payment for USDC bounties.
 *
 * Flow:
 * 1. Fetch review fee from GET /api/bounties/{bountyId}/review-fee
 * 2. If required, build SPL transfer of $FNDRY to treasury
 * 3. User signs with wallet
 * 4. Return signature to include in submission payload
 */

import { useState, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  FNDRY_TOKEN_MINT,
  FNDRY_DECIMALS,
  TREASURY_WALLET,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  findAssociatedTokenAddress,
} from '../config/constants';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export interface ReviewFeeInfo {
  required: boolean;
  fee_fndry: number;
  fee_usdc: number;
  bounty_reward_usdc: number;
  exchange_rate: number;
  funding_token: string;
  price_source: string;
}

export type ReviewFeeStep = 'idle' | 'fetching' | 'ready' | 'building' | 'approving' | 'sending' | 'confirming' | 'paid' | 'error';

export interface UseReviewFeeReturn {
  feeInfo: ReviewFeeInfo | null;
  step: ReviewFeeStep;
  signature: string | null;
  error: string | null;
  fetchFee: () => Promise<ReviewFeeInfo | null>;
  payFee: () => Promise<string | null>;
  reset: () => void;
}

function buildTransferCheckedInstruction(
  source: PublicKey,
  mint: PublicKey,
  dest: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals: number,
): TransactionInstruction {
  // SPL TransferChecked instruction (discriminator = 12)
  const data = new Uint8Array(1 + 8 + 1);
  const view = new DataView(data.buffer);
  data[0] = 12; // TransferChecked discriminator
  view.setBigUint64(1, amount, true);
  data[9] = decimals;

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: data as Buffer,
  });
}

function buildCreateAtaInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: new Uint8Array(0) as Buffer,
  });
}

export function useReviewFee(bountyId: string): UseReviewFeeReturn {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [feeInfo, setFeeInfo] = useState<ReviewFeeInfo | null>(null);
  const [step, setStep] = useState<ReviewFeeStep>('idle');
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFee = useCallback(async (): Promise<ReviewFeeInfo | null> => {
    setStep('fetching');
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/review-fee`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to fetch review fee' }));
        setError(err.detail || 'Failed to fetch review fee');
        setStep('error');
        return null;
      }
      const data: ReviewFeeInfo = await res.json();
      setFeeInfo(data);
      setStep(data.required ? 'ready' : 'idle');
      return data;
    } catch (e: any) {
      setError(e.message || 'Network error');
      setStep('error');
      return null;
    }
  }, [bountyId]);

  const payFee = useCallback(async (): Promise<string | null> => {
    if (!feeInfo || !feeInfo.required) return null;
    if (!publicKey) {
      setError('Please connect your wallet to pay the review fee');
      setStep('error');
      return null;
    }
    if (!signTransaction) {
      setError('Wallet does not support signing');
      setStep('error');
      return null;
    }

    setError(null);
    setStep('building');

    try {
      const rawAmount = BigInt(Math.floor(feeInfo.fee_fndry * 10 ** FNDRY_DECIMALS));

      const sourceAta = await findAssociatedTokenAddress(publicKey, FNDRY_TOKEN_MINT);
      const destAta = await findAssociatedTokenAddress(TREASURY_WALLET, FNDRY_TOKEN_MINT);

      const tx = new Transaction();

      // Create treasury ATA if needed
      const destInfo = await connection.getAccountInfo(destAta);
      if (!destInfo) {
        tx.add(buildCreateAtaInstruction(publicKey, destAta, TREASURY_WALLET, FNDRY_TOKEN_MINT));
      }

      // TransferChecked (backend only accepts transferChecked for verification)
      tx.add(
        buildTransferCheckedInstruction(
          sourceAta,
          FNDRY_TOKEN_MINT,
          destAta,
          publicKey,
          rawAmount,
          FNDRY_DECIMALS,
        ),
      );

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      setStep('approving');
      const signedTx = await signTransaction(tx);

      setStep('sending');
      const sig = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      setStep('confirming');
      const confirmation = await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed',
      );

      if (confirmation.value.err) {
        throw new Error('Review fee transaction failed on-chain');
      }

      setSignature(sig);
      setStep('paid');
      return sig;
    } catch (e: any) {
      const msg = e.message || 'Review fee payment failed';
      if (msg.includes('User rejected') || msg.includes('user rejected')) {
        setError('Transaction was rejected in your wallet. No funds were moved.');
      } else if (msg.includes('insufficient') || msg.includes('Insufficient')) {
        setError('Insufficient $FNDRY balance for the review fee.');
      } else {
        setError(msg);
      }
      setStep('error');
      return null;
    }
  }, [feeInfo, publicKey, signTransaction, connection]);

  const reset = useCallback(() => {
    setStep('idle');
    setSignature(null);
    setError(null);
  }, []);

  return { feeInfo, step, signature, error, fetchFee, payFee, reset };
}
