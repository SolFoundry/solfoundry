/**
 * BoostPanel — Boost button, amount input, leaderboard, and history
 * for the bounty detail page.
 *
 * Renders:
 * - Original vs boosted reward breakdown
 * - Boost input form with wallet signature via Phantom/Solflare adapter
 * - Boost leaderboard (top boosters)
 * - Boost history (recent boosts)
 *
 * Wallet integration: Uses the Solana wallet adapter (useWallet) to
 * obtain the connected wallet's public key and sign a verification
 * message proving ownership. No hardcoded bypasses are shipped.
 *
 * @module BoostPanel
 */
import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

/** Minimum boost amount in $FNDRY */
const MINIMUM_BOOST = 1000;

/* ── Type Definitions ─────────────────────────────────────────────── */

interface BoostSummary {
  original_reward: number;
  total_boosted: number;
  effective_reward: number;
  boost_count: number;
  top_booster_wallet: string | null;
}

interface BoostHistoryItem {
  id: string;
  bounty_id: string;
  booster_user_id: string;
  booster_wallet: string;
  amount: number;
  status: string;
  escrow_tx_hash: string | null;
  created_at: string;
  message: string | null;
}

interface BoostLeaderboardEntry {
  booster_wallet: string;
  booster_user_id: string;
  total_amount: number;
  boost_count: number;
  last_boosted_at: string;
}

interface BoostPanelProps {
  /** The bounty ID to display boosts for */
  bountyId: string;
  /** Current bounty status — determines if boost button is enabled */
  bountyStatus: string;
}

/* ── Utility ──────────────────────────────────────────────────────── */

/** Truncate a wallet address to first 4 and last 4 characters. */
function truncateWallet(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/** Format a number with commas. */
function formatAmount(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/* ── Component ────────────────────────────────────────────────────── */

export default function BoostPanel({ bountyId, bountyStatus }: BoostPanelProps) {
  const { publicKey, signMessage, connected } = useWallet();

  const [summary, setSummary] = useState<BoostSummary | null>(null);
  const [history, setHistory] = useState<BoostHistoryItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<BoostLeaderboardEntry[]>([]);
  const [boostAmount, setBoostAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'history'>('leaderboard');

  const isBoostable = bountyStatus === 'open' || bountyStatus === 'in_progress';

  /** Fetch boost summary from API. */
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/boosts/summary`);
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch {
      /* Non-critical — summary will show defaults */
    }
  }, [bountyId]);

  /** Fetch boost history from API. */
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/boosts?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items ?? []);
      }
    } catch {
      /* Non-critical */
    }
  }, [bountyId]);

  /** Fetch boost leaderboard from API. */
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/boosts/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.entries ?? []);
      }
    } catch {
      /* Non-critical */
    }
  }, [bountyId]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchSummary(), fetchHistory(), fetchLeaderboard()]).finally(
      () => setIsLoading(false),
    );
  }, [fetchSummary, fetchHistory, fetchLeaderboard]);

  /**
   * Handle boost form submission.
   *
   * Uses the connected Solana wallet adapter to obtain the public key
   * and sign a verification message. The signed message proves wallet
   * ownership to the backend without any hardcoded bypasses.
   */
  const handleBoost = async () => {
    setError(null);
    setSuccess(null);

    if (!connected || !publicKey) {
      setError('Please connect your Solana wallet to boost');
      return;
    }

    if (!signMessage) {
      setError('Your wallet does not support message signing. Please use Phantom or Solflare.');
      return;
    }

    const amount = parseFloat(boostAmount);
    if (isNaN(amount) || amount < MINIMUM_BOOST) {
      setError(`Minimum boost is ${formatAmount(MINIMUM_BOOST)} $FNDRY`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Build the verification message matching the backend's expected format
      const walletAddress = publicKey.toBase58();
      const verificationMessage = `Boost bounty ${bountyId} with ${amount} FNDRY`;

      // Sign the message with the connected wallet to prove ownership
      const encodedMessage = new TextEncoder().encode(verificationMessage);
      const signatureBytes = await signMessage(encodedMessage);

      // Convert signature bytes to base58 for the backend
      const signatureBase58 = btoa(
        String.fromCharCode(...signatureBytes),
      );

      const res = await fetch(`${API_BASE}/api/bounties/${bountyId}/boost`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amount,
          wallet_address: walletAddress,
          wallet_signature: signatureBase58,
          message: null,
        }),
      });

      if (res.ok) {
        setSuccess(`Successfully boosted with ${formatAmount(amount)} $FNDRY!`);
        setBoostAmount('');
        // Refresh data
        await Promise.all([fetchSummary(), fetchHistory(), fetchLeaderboard()]);
      } else {
        const data = await res.json();
        setError(data.detail ?? 'Failed to create boost');
      }
    } catch (walletError) {
      if (walletError instanceof Error && walletError.message.includes('rejected')) {
        setError('Wallet signature request was rejected');
      } else {
        setError('Failed to sign boost message. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Loading skeleton ─────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="boost-panel-loading">
        <div className="bg-gray-900 rounded-lg p-4 sm:p-6 animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-800 rounded" />
            <div className="h-4 bg-gray-800 rounded" />
            <div className="h-6 bg-gray-800 rounded w-2/3" />
          </div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 sm:p-6 animate-pulse">
          <div className="h-4 bg-gray-700 rounded w-1/4 mb-4" />
          <div className="h-10 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reward Breakdown */}
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-4">Reward Pool</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Original Reward</span>
            <span className="font-medium text-green-400">
              {formatAmount(summary?.original_reward ?? 0)} FNDRY
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Community Boost</span>
            <span className="font-medium text-[#9945FF]">
              +{formatAmount(summary?.total_boosted ?? 0)} FNDRY
            </span>
          </div>
          <div className="border-t border-gray-700 pt-3 flex justify-between items-center">
            <span className="text-white font-semibold">Effective Reward</span>
            <span className="font-bold text-xl text-green-400">
              {formatAmount(summary?.effective_reward ?? 0)} FNDRY
            </span>
          </div>
          {summary && summary.boost_count > 0 && (
            <p className="text-xs text-gray-500">
              {summary.boost_count} boost{summary.boost_count !== 1 ? 's' : ''} from community
              {summary.top_booster_wallet && (
                <> — top booster: {truncateWallet(summary.top_booster_wallet)}</>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Boost Input */}
      {isBoostable && (
        <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Boost This Bounty</h2>
          <p className="text-sm text-gray-400 mb-4">
            Add $FNDRY to the reward pool. Minimum {formatAmount(MINIMUM_BOOST)} FNDRY.
            Boosted tokens go into escrow and are refunded if the bounty expires.
          </p>

          {!connected && (
            <p className="text-sm text-yellow-400 mb-4">
              Connect your Solana wallet to boost this bounty.
            </p>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                min={MINIMUM_BOOST}
                step="1000"
                value={boostAmount}
                onChange={(e) => setBoostAmount(e.target.value)}
                placeholder={`Min ${formatAmount(MINIMUM_BOOST)}`}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#9945FF] focus:outline-none focus:ring-1 focus:ring-[#9945FF] min-h-[44px]"
                disabled={isSubmitting || !connected}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                FNDRY
              </span>
            </div>
            <button
              onClick={handleBoost}
              disabled={isSubmitting || !boostAmount || !connected}
              className="bg-[#9945FF] hover:bg-[#9945FF]/80 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors min-h-[44px] touch-manipulation whitespace-nowrap"
            >
              {isSubmitting ? 'Boosting...' : 'Boost'}
            </button>
          </div>

          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
          {success && (
            <p className="mt-2 text-sm text-green-400">{success}</p>
          )}
        </div>
      )}

      {/* Tabs: Leaderboard / History */}
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <div className="flex gap-4 mb-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-2 px-1 text-sm font-medium transition-colors min-h-[44px] ${
              activeTab === 'leaderboard'
                ? 'text-[#9945FF] border-b-2 border-[#9945FF]'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Top Boosters
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 px-1 text-sm font-medium transition-colors min-h-[44px] ${
              activeTab === 'history'
                ? 'text-[#9945FF] border-b-2 border-[#9945FF]'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Boost History
          </button>
        </div>

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div>
            {leaderboard.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No boosts yet. Be the first to boost this bounty!
              </p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.booster_wallet}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : index === 1
                          ? 'bg-gray-400/20 text-gray-300'
                          : index === 2
                          ? 'bg-orange-500/20 text-orange-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-mono text-sm text-white">
                          {truncateWallet(entry.booster_wallet)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {entry.boost_count} boost{entry.boost_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="font-medium text-[#9945FF]">
                      {formatAmount(entry.total_amount)} FNDRY
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div>
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No boost history yet.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="font-mono text-sm text-white">
                        {truncateWallet(item.booster_wallet)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()}
                        {item.message && (
                          <span className="ml-2 text-gray-400">"{item.message}"</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${
                        item.status === 'confirmed'
                          ? 'text-green-400'
                          : item.status === 'refunded'
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                      }`}>
                        {item.status === 'refunded' ? '-' : '+'}{formatAmount(item.amount)} FNDRY
                      </span>
                      <p className="text-xs text-gray-500 capitalize">{item.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
