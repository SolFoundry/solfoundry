/** SolFoundry wallet types for $FNDRY bounty interactions. */
export type SolanaNetwork = 'mainnet-beta' | 'devnet';
export type WalletConnectionStatus = 'connected' | 'disconnected' | 'connecting';
export interface WalletDisplayInfo { address: string; truncatedAddress: string; walletName: string; walletIcon: string; }
export interface NetworkOption { label: string; value: SolanaNetwork; endpoint: string; }

export type TransactionStatus = 'idle' | 'approving' | 'pending' | 'confirming' | 'confirmed' | 'error';

export interface EscrowTransactionState {
  status: TransactionStatus;
  signature: string | null;
  error: string | null;
}

export interface BountyEscrowInfo {
  funded: boolean;
  amount: number;
  signature?: string;
  escrowAddress?: string;
}
