/** Contributor management panel — search, ban/unban, tier and score display. */
import { useState } from 'react';
import {
  useAdminContributors,
  useBanContributor,
  useUnbanContributor,
} from '../../hooks/useAdminData';
import type { ContributorAdminItem } from '../../types/admin';

interface BanModalProps {
  contributor: ContributorAdminItem;
  onClose: () => void;
}

function BanModal({ contributor, onClose }: BanModalProps) {
  const [reason, setReason] = useState('');
  const ban = useBanContributor();

  const handleBan = async () => {
    if (reason.trim().length < 5) return;
    await ban.mutateAsync({ id: contributor.id, reason: reason.trim() });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      data-testid="ban-modal"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121f] p-6 space-y-4">
        <h3 className="text-sm font-semibold">Ban Contributor</h3>
        <p className="text-xs text-gray-400">
          Banning <span className="text-white font-medium">@{contributor.username}</span>
        </p>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Reason (required)</label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Describe the reason for this ban…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/40 resize-none"
            data-testid="ban-reason"
          />
          {reason.trim().length > 0 && reason.trim().length < 5 && (
            <p className="text-xs text-red-400 mt-1">Reason must be at least 5 characters</p>
          )}
        </div>

        {ban.isError && (
          <p className="text-xs text-red-400">{(ban.error as Error).message}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleBan}
            disabled={ban.isPending || reason.trim().length < 5}
            className="flex-1 rounded-lg bg-red-500/15 text-red-400 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-40 transition-colors"
            data-testid="confirm-ban-btn"
          >
            {ban.isPending ? 'Banning…' : 'Confirm Ban'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ContributorManagement() {
  const [search, setSearch] = useState('');
  const [bannedFilter, setBannedFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [banning, setBanning] = useState<ContributorAdminItem | null>(null);

  const unban = useUnbanContributor();

  const { data, isLoading, error } = useAdminContributors({
    search: search || undefined,
    isBanned: bannedFilter,
    page,
    perPage: 20,
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="p-6 space-y-4" data-testid="contributor-management">
      {banning && <BanModal contributor={banning} onClose={() => setBanning(null)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contributor Management</h2>
        {data && <span className="text-xs text-gray-500">{data.total} total</span>}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search username…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9945FF]/50 w-56"
          data-testid="contributor-search"
        />
        <select
          value={bannedFilter === undefined ? '' : String(bannedFilter)}
          onChange={e => {
            setPage(1);
            if (e.target.value === '') setBannedFilter(undefined);
            else setBannedFilter(e.target.value === 'true');
          }}
          className="rounded-lg border border-white/10 bg-[#0a0a14] px-3 py-1.5 text-sm text-white focus:outline-none"
          data-testid="banned-filter"
        >
          <option value="">All</option>
          <option value="false">Active</option>
          <option value="true">Banned</option>
        </select>
      </div>

      {/* Table */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}

      {data && data.items.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-12">No contributors found</p>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-xs" data-testid="contributor-table">
            <thead>
              <tr className="border-b border-white/5 text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Username</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-right px-4 py-3 font-medium">Rep Score</th>
                <th className="text-right px-4 py-3 font-medium">Quality</th>
                <th className="text-right px-4 py-3 font-medium">Completed</th>
                <th className="text-right px-4 py-3 font-medium">Earnings</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(c => (
                <tr
                  key={c.id}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  data-testid={`contributor-row-${c.id}`}
                >
                  <td className="px-4 py-3 font-medium">
                    <a
                      href={`/profile/${c.username}`}
                      className="text-[#9945FF] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      @{c.username}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.tier}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.reputation_score.toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={`font-medium ${(c.quality_score ?? 0) >= 70 ? 'text-[#14F195]' : (c.quality_score ?? 0) >= 40 ? 'text-yellow-400' : 'text-gray-400'}`}>
                      {(c.quality_score ?? 0).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.total_bounties_completed}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#14F195]">
                    {c.total_earnings.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {c.is_banned ? (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-red-400 bg-red-400/10">
                        Banned
                      </span>
                    ) : (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-[#14F195] bg-[#14F195]/10">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.is_banned ? (
                      <button
                        onClick={() => unban.mutate(c.id)}
                        disabled={unban.isPending}
                        className="text-[#14F195] hover:opacity-70 text-[10px] underline disabled:opacity-40"
                        data-testid={`unban-${c.id}`}
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => setBanning(c)}
                        className="text-red-400 hover:opacity-70 text-[10px] underline"
                        data-testid={`ban-${c.id}`}
                      >
                        Ban
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
