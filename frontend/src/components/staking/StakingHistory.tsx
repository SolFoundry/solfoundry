/**
 * StakingHistory — Transaction history table for $FNDRY staking operations.
 *
 * Displays a chronologically sorted table of stake deposits, unstake withdrawals,
 * and reward claims with on-chain transaction links. Includes type badges,
 * formatted amounts, relative timestamps, and mobile-responsive layout.
 *
 * @module components/staking/StakingHistory
 */
import type { StakingHistoryEntry, StakingTransactionType } from '../../types/staking';

/** Props for the StakingHistory component. */
interface StakingHistoryProps {
  /** Array of staking history entries, sorted newest first. */
  entries: StakingHistoryEntry[];
  /** Whether the history data is currently loading. */
  isLoading: boolean;
}

/**
 * Metadata for each transaction type: display label, color, and icon.
 */
const TRANSACTION_TYPE_CONFIG: Record<StakingTransactionType, { label: string; color: string; bgColor: string; icon: string }> = {
  stake: { label: 'Stake', color: '#14F195', bgColor: 'rgba(20, 241, 149, 0.1)', icon: 'arrow-down' },
  unstake: { label: 'Unstake', color: '#FF6B6B', bgColor: 'rgba(255, 107, 107, 0.1)', icon: 'arrow-up' },
  claim_reward: { label: 'Reward', color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.1)', icon: 'gift' },
};

/**
 * Format a token amount with comma separators and $FNDRY suffix.
 *
 * @param amount - Raw token amount.
 * @param type - Transaction type to determine +/- prefix.
 * @returns Formatted string like "+250,000 $FNDRY" or "-50,000 $FNDRY".
 */
function formatTransactionAmount(amount: number, type: StakingTransactionType): string {
  const prefix = type === 'unstake' ? '-' : '+';
  return `${prefix}${amount.toLocaleString('en-US')} $FNDRY`;
}

/**
 * Format a timestamp as a relative or absolute date string.
 *
 * @param timestamp - ISO 8601 date string.
 * @returns Human-readable date like "Mar 20, 2026" or "2 days ago".
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Render a type-appropriate icon for the transaction entry.
 *
 * @param type - The staking transaction type.
 * @param color - Hex color for the icon.
 * @returns SVG icon element.
 */
function TransactionIcon({ type, color }: { type: StakingTransactionType; color: string }) {
  if (type === 'stake') {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
      </svg>
    );
  }
  if (type === 'unstake') {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

/**
 * StakingHistory — Staking operations history table with transaction links.
 *
 * Renders a responsive table/list of staking history entries.
 * Shows loading skeleton while data is being fetched.
 * Empty state message when no history exists.
 */
export function StakingHistory({ entries, isLoading }: StakingHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="staking-history-loading">
        <h3 className="text-lg font-semibold text-white">Staking History</h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg bg-surface-100 h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="staking-history">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Staking History</h3>
        <span className="text-xs text-gray-500">{entries.length} transactions</span>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-surface-50 p-8 text-center">
          <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <p className="text-sm text-gray-500">No staking history yet.</p>
          <p className="text-xs text-gray-600 mt-1">Stake $FNDRY to start earning rewards.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const config = TRANSACTION_TYPE_CONFIG[entry.type];
            return (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-gray-800 bg-surface-50 px-4 py-3 hover:bg-surface-100 transition-colors"
                data-testid={`history-entry-${entry.id}`}
              >
                {/* Icon */}
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: config.bgColor }}
                >
                  <TransactionIcon type={entry.type} color={config.color} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ color: config.color, backgroundColor: config.bgColor }}
                    >
                      {config.label}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:inline">{formatTimestamp(entry.timestamp)}</span>
                  </div>
                  <a
                    href={`https://solscan.io/tx/${entry.transactionSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-500 font-mono hover:text-[#9945FF] truncate block mt-0.5"
                    title={entry.transactionSignature}
                  >
                    {entry.transactionSignature}
                  </a>
                </div>

                {/* Amount */}
                <div className="flex-shrink-0 text-right">
                  <p
                    className="text-sm font-semibold font-mono"
                    style={{ color: config.color }}
                  >
                    {formatTransactionAmount(entry.amount, entry.type)}
                  </p>
                  <span className="text-xs text-gray-500 sm:hidden">{formatTimestamp(entry.timestamp)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
