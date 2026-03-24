/**
 * Escrow types for bounty escrow integration with the SolFoundry Anchor program.
 * Covers all escrow states, transaction flows, API response shapes, and
 * client-side transaction progress tracking.
 *
 * The escrow program uses per-bounty PDA accounts derived from
 * seeds ["escrow", bounty_id_bytes]. The PDA authority signs all
 * release and refund token transfers.
 *
 * @module types/escrow
 */

/** Possible states for an escrow account throughout its lifecycle. */
export type EscrowState =
  | 'unfunded'
  | 'funded'
  | 'locked'
  | 'released'
  | 'refunded'
  | 'expired';

/** A single escrow transaction event recorded on-chain or in the backend. */
export interface EscrowTransaction {
  /** Unique identifier for the transaction record. */
  readonly id: string;
  /** Solana transaction signature (base58). */
  readonly signature: string;
  /** Type of escrow operation performed. */
  readonly type: 'deposit' | 'release' | 'refund';
  /** Lamport amount in raw token units (string to avoid BigInt serialization). */
  readonly amountRaw: string;
  /** Human-readable amount with decimals applied. */
  readonly amountDisplay: number;
  /** ISO 8601 timestamp of when the transaction was confirmed. */
  readonly confirmedAt: string;
  /** Wallet address of the signer who initiated the transaction. */
  readonly signer: string;
}

/** Full escrow account information returned from the backend API. */
export interface EscrowAccount {
  /** The on-chain PDA address for this escrow account (derived from bounty ID). */
  readonly escrowAddress: string;
  /** The bounty ID this escrow is associated with. */
  readonly bountyId: string;
  /** Current state of the escrow. */
  readonly state: EscrowState;
  /** Total amount currently held in escrow (display units). */
  readonly lockedAmount: number;
  /** Raw token amount as a string (to preserve precision, avoid floating-point). */
  readonly lockedAmountRaw: string;
  /** The wallet address of the bounty owner who deposited funds. */
  readonly ownerWallet: string;
  /** The wallet address of the contributor who will receive funds (if assigned). */
  readonly contributorWallet?: string;
  /** Transaction history for this escrow account. */
  readonly transactions: EscrowTransaction[];
  /** ISO 8601 timestamp for when the escrow was created. */
  readonly createdAt: string;
  /** ISO 8601 timestamp for when the escrow was last updated. */
  readonly updatedAt: string;
  /** ISO 8601 timestamp for when the escrow expires (refund becomes available). */
  readonly expiresAt?: string;
}

/** Parameters required to initiate a deposit into the escrow. */
export interface DepositParams {
  /** The bounty ID to fund. */
  readonly bountyId: string;
  /** Amount of $FNDRY tokens to deposit (display units). */
  readonly amount: number;
}

/** Parameters required to release funds from escrow to a contributor. */
export interface ReleaseParams {
  /** The bounty ID whose escrow to release. */
  readonly bountyId: string;
  /** Wallet address of the contributor receiving funds. */
  readonly contributorWallet: string;
}

/** Parameters required to refund escrowed funds back to the owner. */
export interface RefundParams {
  /** The bounty ID whose escrow to refund. */
  readonly bountyId: string;
}

/**
 * Status of an in-progress escrow transaction on the client side.
 * The 'sending' step occurs after wallet approval and before network confirmation.
 */
export type EscrowTransactionStep =
  | 'idle'
  | 'building'
  | 'approving'
  | 'sending'
  | 'confirming'
  | 'confirmed'
  | 'error';

/** Client-side state for tracking an escrow transaction lifecycle. */
export interface EscrowTransactionProgress {
  /** Current step in the transaction flow. */
  readonly step: EscrowTransactionStep;
  /** Transaction signature once available (null before signing). */
  readonly signature: string | null;
  /** Error message if the transaction fails at any step. */
  readonly errorMessage: string | null;
  /** The operation type being performed (deposit, release, or refund). */
  readonly operationType: 'deposit' | 'release' | 'refund' | null;
}

/** Initial (idle) state for escrow transaction progress tracking. */
export const INITIAL_TRANSACTION_PROGRESS: EscrowTransactionProgress = {
  step: 'idle',
  signature: null,
  errorMessage: null,
  operationType: null,
};
