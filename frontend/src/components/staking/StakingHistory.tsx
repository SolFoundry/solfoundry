/**
 * StakingHistory — paginated event history table for a wallet's staking activity.
 */
import React, { useState } from 'react';
import type { StakingEvent } from '../../types/staking';

interface StakingHistoryProps {
  items: StakingEvent[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  perPage?: number;
  loading?: boolean;
  className?: string;
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  stake: { label: 'Staked', color: 'text-[#14F195]' },
  unstake_initiated: { label: 'Unstake started', color: 'text-amber-400' },
  unstake_completed: { label: 'Unstaked', color: 'text-orange-400' },
  reward_claimed: { label: 'Rewards claimed', color: 'text-[#9945FF]' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StakingHistory({
  items,
  total,
  page,
  onPageChange,
  perPage = 10,
  loading = false,
  className = '',
}: StakingHistoryProps) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (!loading && items.length === 0) {
    return (
      <div
        className={`rounded-xl border border-white/10 bg-white/5 p-8 text-center ${className}`}
        data-testid="staking-history-empty"
      >
        <p className="text-2xl mb-2">📭</p>
        <p className="text-gray-400 text-sm">No staking activity yet</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/5 overflow-hidden ${className}`}
      data-testid="staking-history"
    >
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Transaction history
        </h3>
      </div>

      <div className="divide-y divide-white/5">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between animate-pulse">
                <div className="h-4 w-32 bg-white/10 rounded" />
                <div className="h-4 w-20 bg-white/10 rounded" />
              </div>
            ))
          : items.map((evt) => {
              const meta = EVENT_LABELS[evt.event_type] ?? {
                label: evt.event_type,
                color: 'text-gray-400',
              };
              return (
                <div key={evt.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${meta.color}`}>{meta.label}</p>
                    <p className="text-xs text-gray-500 truncate">{formatDate(evt.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white">
                      {(evt.rewards_amount ?? evt.amount).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{' '}
                      $FNDRY
                    </p>
                    {evt.signature && (
                      <p className="text-xs text-gray-600 font-mono truncate max-w-[120px]">
                        {evt.signature.slice(0, 8)}…
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
      </div>

      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages} · {total} events
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 text-xs rounded bg-white/10 text-gray-300 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
