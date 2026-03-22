import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { PlusCircle, Search, ChevronUp, ChevronDown, X, CheckCircle, XCircle, Edit2 } from 'lucide-react';
import { clsx } from 'clsx';
import { bounties as bountiesApi, type Bounty, type BountyFilter } from '../api/client';
import { formatDistanceToNow } from 'date-fns';

// ─── Status badge ─────────────────────────────────────────────────────────────

const statusConfig: Record<Bounty['status'], { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-violet-500/15 text-violet-300 ring-violet-500/30' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-500/15 text-blue-300 ring-blue-500/30' },
  review: { label: 'In Review', cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30' },
  closed: { label: 'Closed', cls: 'bg-slate-500/15 text-slate-400 ring-slate-500/30' },
};

function StatusBadge({ status }: { status: Bounty['status'] }) {
  const cfg = statusConfig[status];
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: Bounty['tier'] }) {
  const color = tier === 3 ? 'text-amber-400' : tier === 2 ? 'text-slate-300' : 'text-slate-500';
  return <span className={clsx('text-xs font-bold', color)}>T{tier}</span>;
}

// ─── Create / Edit modal ──────────────────────────────────────────────────────

interface BountyFormProps {
  initial?: Partial<Bounty>;
  onSubmit: (data: Partial<Bounty>) => void;
  onClose: () => void;
  loading: boolean;
}

function BountyForm({ initial, onSubmit, onClose, loading }: BountyFormProps) {
  const [form, setForm] = useState<Partial<Bounty>>(initial ?? {});

  const set = (key: keyof Bounty, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial?.id ? 'Edit Bounty' : 'Create Bounty'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Title</label>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              value={form.title ?? ''}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Bounty title..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none resize-none"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe the task..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Reward ($FNDRY)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                value={form.reward ?? ''}
                onChange={(e) => set('reward', Number(e.target.value))}
                placeholder="1000000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Tier</label>
              <select
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                value={form.tier ?? ''}
                onChange={(e) => set('tier', Number(e.target.value) as Bounty['tier'])}
              >
                <option value="">Select tier...</option>
                <option value="1">Tier 1</option>
                <option value="2">Tier 2</option>
                <option value="3">Tier 3</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">GitHub Issue #</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              value={form.issueNumber ?? ''}
              onChange={(e) => set('issueNumber', Number(e.target.value))}
              placeholder="599"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={loading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : initial?.id ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Column helper ────────────────────────────────────────────────────────────

const col = createColumnHelper<Bounty>();

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BountiesPage() {
  const qc = useQueryClient();

  const [filter, setFilter] = useState<BountyFilter>({ page: 1, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [editTarget, setEditTarget] = useState<Bounty | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['bounties', filter],
    queryFn: () => bountiesApi.list({ ...filter, search: search || undefined }),
    staleTime: 15_000,
  });

  const createMutation = useMutation({
    mutationFn: bountiesApi.create,
    onSuccess: () => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['bounties'] }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Bounty> }) => bountiesApi.update(id, payload),
    onSuccess: () => { setEditTarget(null); qc.invalidateQueries({ queryKey: ['bounties'] }); },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => bountiesApi.close(id, 'Closed by admin'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bounties'] }),
  });

  const approveMutation = useMutation({
    mutationFn: bountiesApi.approve,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bounties'] }),
  });

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setFilter((f) => ({ ...f, page: 1 }));
  }, []);

  const columns = [
    col.accessor('issueNumber', {
      header: '#',
      cell: (info) => <span className="font-mono text-xs text-slate-400">#{info.getValue()}</span>,
      size: 60,
    }),
    col.accessor('title', {
      header: 'Title',
      cell: (info) => (
        <div>
          <p className="font-medium text-white">{info.getValue()}</p>
          {info.row.original.assignee && (
            <p className="text-xs text-slate-500">Assignee: {info.row.original.assignee}</p>
          )}
        </div>
      ),
    }),
    col.accessor('tier', {
      header: 'Tier',
      cell: (info) => <TierBadge tier={info.getValue()} />,
      size: 60,
    }),
    col.accessor('reward', {
      header: 'Reward',
      cell: (info) => (
        <span className="font-mono text-sm font-medium text-amber-400">
          {(info.getValue() / 1_000_000).toFixed(1)}M
        </span>
      ),
      size: 110,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
      size: 120,
    }),
    col.accessor('updatedAt', {
      header: 'Updated',
      cell: (info) => (
        <span className="text-xs text-slate-500">
          {formatDistanceToNow(new Date(info.getValue()), { addSuffix: true })}
        </span>
      ),
      size: 120,
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setEditTarget(b)}
              title="Edit"
              className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            {b.status === 'review' && (
              <button
                onClick={() => approveMutation.mutate(b.id)}
                title="Approve"
                className="rounded p-1 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </button>
            )}
            {b.status !== 'closed' && b.status !== 'completed' && (
              <button
                onClick={() => { if (confirm('Close this bounty?')) closeMutation.mutate(b.id); }}
                title="Close"
                className="rounded p-1 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        );
      },
      size: 100,
    }),
  ];

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? 0,
  });

  return (
    <div className="min-h-screen bg-slate-900 p-6 text-white">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bounties</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data?.total ?? '…'} total bounties
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          New Bounty
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="rounded-lg border border-slate-600 bg-slate-800 py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none w-56"
            placeholder="Search bounties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
        {(['open', 'in_progress', 'review', 'completed', 'closed'] as Bounty['status'][]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter((f) => ({ ...f, status: f.status === s ? undefined : s, page: 1 }))}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              filter.status === s
                ? 'bg-violet-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
            )}
          >
            {statusConfig[s].label}
          </button>
        ))}
        {([1, 2, 3] as Bounty['tier'][]).map((t) => (
          <button
            key={t}
            onClick={() => setFilter((f) => ({ ...f, tier: f.tier === t ? undefined : t, page: 1 }))}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
              filter.tier === t ? 'bg-amber-500 text-white' : 'bg-slate-700 text-amber-400 hover:bg-slate-600',
            )}
          >
            T{t}
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
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className={clsx('flex items-center gap-1', header.column.getCanSort() && 'cursor-pointer hover:text-white')}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp className="h-3 w-3" />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
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
                <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                  No bounties found
                </td>
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
          <p>Page {filter.page} of {data.totalPages} ({data.total} total)</p>
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
      {showCreate && (
        <BountyForm
          onSubmit={(data) => createMutation.mutate(data)}
          onClose={() => setShowCreate(false)}
          loading={createMutation.isPending}
        />
      )}
      {editTarget && (
        <BountyForm
          initial={editTarget}
          onSubmit={(payload) => updateMutation.mutate({ id: editTarget.id, payload })}
          onClose={() => setEditTarget(null)}
          loading={updateMutation.isPending}
        />
      )}
    </div>
  );
}
