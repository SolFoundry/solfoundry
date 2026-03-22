import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Search, CheckCircle, Ban, ChevronRight, X, Star, Clock, Award } from 'lucide-react';
import { clsx } from 'clsx';
import {
  contributors as contributorsApi,
  type Contributor,
  type ContributorFilter,
  type ActivityEvent,
} from '../api/client';
import { formatDistanceToNow, format } from 'date-fns';

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusConfig: Record<Contributor['status'], { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  pending: { label: 'Pending', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  banned: { label: 'Banned', cls: 'bg-red-500/15 text-red-300 ring-red-500/30' },
};

function StatusBadge({ status }: { status: Contributor['status'] }) {
  const cfg = statusConfig[status];
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ─── Reputation score bar ─────────────────────────────────────────────────────

function ReputationBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2" title={`Reputation: ${score}/100`}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
        <div className={clsx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-400">{score}</span>
    </div>
  );
}

// ─── History modal ─────────────────────────────────────────────────────────────

const eventTypeIcon: Record<ActivityEvent['type'], React.ReactNode> = {
  bounty_created: <Award className="h-3.5 w-3.5 text-violet-400" />,
  bounty_completed: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />,
  bounty_closed: <X className="h-3.5 w-3.5 text-red-400" />,
  contributor_joined: <Star className="h-3.5 w-3.5 text-amber-400" />,
  payout_sent: <ChevronRight className="h-3.5 w-3.5 text-blue-400" />,
};

interface HistoryModalProps {
  contributor: Contributor;
  onClose: () => void;
}

function HistoryModal({ contributor, onClose }: HistoryModalProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['contributor-history', contributor.address],
    queryFn: () => contributorsApi.getHistory(contributor.address),
    staleTime: 30_000,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl overflow-hidden">
        {/* Modal header */}
        <div className="flex items-start justify-between border-b border-slate-700 p-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Contributor History</h2>
            <div className="mt-1 flex items-center gap-3">
              <a
                href={`https://github.com/${contributor.githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-violet-400 hover:underline"
              >
                @{contributor.githubHandle}
              </a>
              <StatusBadge status={contributor.status} />
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-slate-700/60 border-b border-slate-700/60">
          {[
            { label: 'Reputation', value: contributor.reputationScore },
            { label: 'Bounties Completed', value: contributor.bountiesCompleted },
            { label: 'Total Earned', value: `${(contributor.totalEarned / 1_000_000).toFixed(2)}M $FNDRY` },
          ].map((s) => (
            <div key={s.label} className="p-4 text-center">
              <p className="text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Wallet address */}
        <div className="border-b border-slate-700/60 px-5 py-3 flex items-center gap-2">
          <span className="text-xs text-slate-500">Wallet:</span>
          <code className="text-xs font-mono text-slate-300 break-all">{contributor.address}</code>
        </div>

        {/* Activity timeline */}
        <div className="max-h-80 overflow-y-auto p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Activity Timeline</h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-6 w-6 animate-pulse rounded-full bg-slate-700" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-slate-700" />
                    <div className="h-3 w-1/4 animate-pulse rounded bg-slate-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : history && history.length > 0 ? (
            <ol className="relative border-l border-slate-700/60 space-y-4 pl-5">
              {history.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[22px] flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 ring-2 ring-slate-800">
                    {eventTypeIcon[event.type]}
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-200">{event.description}</p>
                    <time className="shrink-0 text-xs text-slate-500">
                      {format(new Date(event.timestamp), 'MMM d, yyyy')}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-center text-sm text-slate-500 py-6">No activity recorded</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-700 p-4">
          <p className="text-xs text-slate-500">
            Joined {formatDistanceToNow(new Date(contributor.joinedAt), { addSuffix: true })}
          </p>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ban confirmation modal ────────────────────────────────────────────────────

interface BanModalProps {
  contributor: Contributor;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading: boolean;
}

function BanModal({ contributor, onConfirm, onClose, loading }: BanModalProps) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <h2 className="mb-2 text-lg font-semibold text-white">Ban Contributor</h2>
        <p className="mb-4 text-sm text-slate-400">
          You are about to ban <span className="font-mono text-slate-200">@{contributor.githubHandle}</span>. This will prevent them from claiming bounties.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">Reason (required)</label>
          <textarea
            rows={3}
            className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-red-500 focus:outline-none resize-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Violation of contribution policy..."
          />
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button
            onClick={() => reason.trim() && onConfirm(reason)}
            disabled={!reason.trim() || loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Banning...' : 'Confirm Ban'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Column helper ────────────────────────────────────────────────────────────

const col = createColumnHelper<Contributor>();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContributorsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<ContributorFilter>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState('');
  const [viewHistory, setViewHistory] = useState<Contributor | null>(null);
  const [banTarget, setBanTarget] = useState<Contributor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contributors', filter],
    queryFn: () => contributorsApi.list({ ...filter, search: search || undefined }),
    staleTime: 15_000,
  });

  const approveMutation = useMutation({
    mutationFn: contributorsApi.approve,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contributors'] }),
  });

  const banMutation = useMutation({
    mutationFn: ({ address, reason }: { address: string; reason: string }) =>
      contributorsApi.ban(address, reason),
    onSuccess: () => { setBanTarget(null); qc.invalidateQueries({ queryKey: ['contributors'] }); },
  });

  const columns = [
    col.accessor('githubHandle', {
      header: 'GitHub',
      cell: (info) => (
        <a
          href={`https://github.com/${info.getValue()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-violet-400 hover:underline"
        >
          @{info.getValue()}
        </a>
      ),
    }),
    col.accessor('address', {
      header: 'Wallet',
      cell: (info) => (
        <code className="text-xs font-mono text-slate-400">
          {info.getValue().slice(0, 8)}…{info.getValue().slice(-4)}
        </code>
      ),
    }),
    col.accessor('reputationScore', {
      header: 'Reputation',
      cell: (info) => <ReputationBar score={info.getValue()} />,
    }),
    col.accessor('bountiesCompleted', {
      header: 'Completed',
      cell: (info) => (
        <span className="flex items-center gap-1 text-sm font-medium text-white">
          <Award className="h-3.5 w-3.5 text-amber-400" />
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor('totalEarned', {
      header: 'Total Earned',
      cell: (info) => (
        <span className="font-mono text-sm text-amber-400">
          {(info.getValue() / 1_000_000).toFixed(2)}M
        </span>
      ),
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    col.accessor('lastActiveAt', {
      header: 'Last Active',
      cell: (info) => (
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(info.getValue()), { addSuffix: true })}
        </span>
      ),
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewHistory(c)}
              title="View history"
              className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {c.status === 'pending' && (
              <button
                onClick={() => approveMutation.mutate(c.address)}
                title="Approve"
                className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
              </button>
            )}
            {c.status !== 'banned' && (
              <button
                onClick={() => setBanTarget(c)}
                title="Ban"
                className="rounded p-1 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Ban className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contributors</h1>
          <p className="mt-1 text-sm text-slate-400">{data?.total ?? '…'} registered</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="rounded-lg border border-slate-600 bg-slate-800 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none w-56"
            placeholder="Search by handle or address..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setFilter((f) => ({ ...f, page: 1 })); }}
          />
        </div>
        {(['active', 'pending', 'banned'] as Contributor['status'][]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter((f) => ({ ...f, status: f.status === s ? undefined : s, page: 1 }))}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors capitalize',
              filter.status === s
                ? 'bg-violet-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-700/60 bg-slate-800/60">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-700/60">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-700/40">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-slate-700" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-slate-500">No contributors found</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-700/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <p>Page {filter.page} of {data.totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={(filter.page ?? 1) <= 1}
              onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="rounded-lg bg-slate-700 px-3 py-1.5 hover:bg-slate-600 disabled:opacity-40"
            >← Prev</button>
            <button
              disabled={(filter.page ?? 1) >= data.totalPages}
              onClick={() => setFilter((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="rounded-lg bg-slate-700 px-3 py-1.5 hover:bg-slate-600 disabled:opacity-40"
            >Next →</button>
          </div>
        </div>
      )}

      {/* Modals */}
      {viewHistory && <HistoryModal contributor={viewHistory} onClose={() => setViewHistory(null)} />}
      {banTarget && (
        <BanModal
          contributor={banTarget}
          onConfirm={(reason) => banMutation.mutate({ address: banTarget.address, reason })}
          onClose={() => setBanTarget(null)}
          loading={banMutation.isPending}
        />
      )}
    </div>
  );
}
