/**
 * EscrowStatusDisplay — Enhanced escrow status widget for the bounty detail page.
 * Shows the escrow state, locked amount, transaction history, and Solscan links.
 * Supports all escrow lifecycle states: unfunded, funded, locked, released, refunded, expired.
 *
 * @module components/escrow/EscrowStatusDisplay
 */

import { solscanTxUrl, solscanAddressUrl } from '../../config/constants';
import type { EscrowAccount, EscrowState, EscrowTransaction } from '../../types/escrow';
import type { SolanaNetwork } from '../../types/wallet';
import { Skeleton } from '../common/Skeleton';

/** Color and label configuration for each escrow state. */
const STATE_CONFIG: Record<
  EscrowState,
  { label: string; dotColor: string; textColor: string; bgColor: string }
> = {
  unfunded: {
    label: 'Awaiting Funding',
    dotColor: 'bg-yellow-400 animate-pulse',
    textColor: 'text-yellow-400',
    bgColor: 'bg-yellow-900/10',
  },
  funded: {
    label: 'Funded',
    dotColor: 'bg-green-400',
    textColor: 'text-green-400',
    bgColor: 'bg-green-900/10',
  },
  locked: {
    label: 'Locked in Escrow',
    dotColor: 'bg-purple-400',
    textColor: 'text-purple-400',
    bgColor: 'bg-purple-900/10',
  },
  released: {
    label: 'Released to Contributor',
    dotColor: 'bg-emerald-400',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-900/10',
  },
  refunded: {
    label: 'Refunded to Owner',
    dotColor: 'bg-blue-400',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-900/10',
  },
  expired: {
    label: 'Expired — Refund Available',
    dotColor: 'bg-red-400 animate-pulse',
    textColor: 'text-red-400',
    bgColor: 'bg-red-900/10',
  },
};

/** Label for transaction types in the transaction history list. */
const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  release: 'Release',
  refund: 'Refund',
};

/** Props for the EscrowStatusDisplay component. */
export interface EscrowStatusDisplayProps {
  /** The escrow account data. Null renders a loading or empty state. */
  readonly escrowAccount: EscrowAccount | null;
  /** Whether the escrow data is currently loading. */
  readonly isLoading: boolean;
  /** Error message if the escrow data failed to load. */
  readonly errorMessage: string | null;
  /** The Solana network for generating explorer URLs. */
  readonly network: SolanaNetwork;
}

/**
 * EscrowStatusDisplay renders the current state and history of a bounty's
 * escrow account. Used in the sidebar of the bounty detail page.
 *
 * Features:
 * - Colored state indicator dot with descriptive label
 * - Locked amount display with $FNDRY denomination
 * - Transaction history with Solscan links
 * - Loading skeleton state
 * - Error state with message
 */
export function EscrowStatusDisplay({
  escrowAccount,
  isLoading,
  errorMessage,
  network,
}: EscrowStatusDisplayProps) {
  if (isLoading) {
    return (
      <div
        className="bg-gray-900 rounded-lg p-4 sm:p-6"
        role="status"
        aria-label="Loading escrow status"
      >
        <Skeleton height="1.25rem" width="60%" className="mb-4" />
        <div className="space-y-3">
          <Skeleton height="1rem" width="100%" />
          <Skeleton height="1rem" width="80%" />
          <Skeleton height="1rem" width="60%" />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-3 text-white">Escrow Status</h2>
        <div
          className="bg-red-900/20 border border-red-700/30 rounded-lg p-3"
          role="alert"
        >
          <p className="text-red-400 text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  /** Use a default unfunded state if no escrow account exists yet. */
  const state: EscrowState = escrowAccount?.state ?? 'unfunded';
  const config = STATE_CONFIG[state];
  const lockedAmount = escrowAccount?.lockedAmount ?? 0;
  const transactions = escrowAccount?.transactions ?? [];

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6" data-testid="escrow-status-display">
      {/* Header with state indicator */}
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-white">
        <span
          className={`w-2.5 h-2.5 rounded-full ${config.dotColor}`}
          aria-hidden="true"
        />
        Escrow Status
      </h2>

      <div className="space-y-3">
        {/* State label */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">State</span>
          <span
            className={`text-sm font-medium ${config.textColor}`}
            data-testid="escrow-state"
          >
            {config.label}
          </span>
        </div>

        {/* Locked amount */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Escrowed</span>
          <span
            className="text-green-400 font-bold"
            data-testid="escrow-locked-amount"
          >
            {lockedAmount > 0
              ? `${lockedAmount.toLocaleString()} $FNDRY`
              : '--'}
          </span>
        </div>

        {/* Escrow PDA address link */}
        {escrowAccount?.escrowAddress && (
          <a
            href={solscanAddressUrl(escrowAccount.escrowAddress, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
          >
            Escrow Account: {escrowAccount.escrowAddress.slice(0, 8)}...
            {escrowAccount.escrowAddress.slice(-4)}
          </a>
        )}

        {/* Transaction history */}
        {transactions.length > 0 && (
          <div className="pt-3 border-t border-gray-800">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Transaction History
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {transactions.map((transaction: EscrowTransaction) => (
                <TransactionHistoryItem
                  key={transaction.id}
                  transaction={transaction}
                  network={network}
                />
              ))}
            </div>
          </div>
        )}

        {/* Expiration notice */}
        {escrowAccount?.expiresAt && state !== 'released' && state !== 'refunded' && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Expires: {new Date(escrowAccount.expiresAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Props for the TransactionHistoryItem sub-component. */
interface TransactionHistoryItemProps {
  /** The escrow transaction to display. */
  readonly transaction: EscrowTransaction;
  /** The Solana network for generating explorer URLs. */
  readonly network: SolanaNetwork;
}

/**
 * TransactionHistoryItem renders a single transaction in the escrow history list.
 * Shows the transaction type, amount, timestamp, and a link to the Solana explorer.
 */
function TransactionHistoryItem({
  transaction,
  network,
}: TransactionHistoryItemProps) {
  const typeLabel = TRANSACTION_TYPE_LABELS[transaction.type] ?? transaction.type;
  const formattedDate = new Date(transaction.confirmedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <a
      href={solscanTxUrl(transaction.signature, network)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-800/50 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-300 group-hover:text-white">
          {typeLabel}
        </span>
        <span className="text-xs text-gray-500">{formattedDate}</span>
      </div>
      <span className="text-xs text-green-400 font-mono">
        {transaction.amountDisplay.toLocaleString()}
      </span>
    </a>
  );
}
