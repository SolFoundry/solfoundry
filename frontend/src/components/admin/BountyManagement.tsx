/** Bounty management panel — search, filter, create, edit status/reward, close. */
import { useState } from 'react';
import { useAdminBounties, useUpdateBounty, useCloseBounty, useCreateBounty } from '../../hooks/useAdminData';
import type { BountyAdminItem, BountyAdminCreate } from '../../types/admin';

const STATUS_COLORS: Record<string, string> = {
  open:         'text-[#14F195] bg-[#14F195]/10',
  in_progress:  'text-yellow-400 bg-yellow-400/10',
  under_review: 'text-blue-400 bg-blue-400/10',
  completed:    'text-[#9945FF] bg-[#9945FF]/10',
  paid:         'text-[#9945FF] bg-[#9945FF]/10',
  cancelled:    'text-gray-500 bg-gray-500/10',
  disputed:     'text-red-400 bg-red-400/10',
};

const STATUSES = ['open', 'in_progress', 'under_review', 'completed', 'paid', 'cancelled', 'disputed'];

interface EditModalProps {
  bounty: BountyAdminItem;
  onClose: () => void;
}

function EditModal({ bounty, onClose }: EditModalProps) {
  const [status, setStatus] = useState(bounty.status);
  const [reward, setReward] = useState(String(bounty.reward_amount));
  const [title, setTitle] = useState(bounty.title);
  const update = useUpdateBounty();
  const close = useCloseBounty();

  const handleSave = async () => {
    const patch: Record<string, unknown> = {};
    if (status !== bounty.status) patch.status = status;
    const rewardNum = Number(reward);
    if (!isNaN(rewardNum) && rewardNum !== bounty.reward_amount) patch.reward_amount = rewardNum;
    if (title !== bounty.title) patch.title = title;
    if (Object.keys(patch).length === 0) { onClose(); return; }
    await update.mutateAsync({ id: bounty.id, update: patch });
    onClose();
  };

  const handleClose = async () => {
    await close.mutateAsync(bounty.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      data-testid="bounty-edit-modal"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#12121f] p-6 space-y-4">
        <h3 className="text-sm font-semibold">Edit Bounty</h3>
        <p className="text-xs text-gray-500 truncate">{bounty.id}</p>

        {/* Title */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#9945FF]/50"
            data-testid="edit-title"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0a0a14] px-3 py-1.5 text-sm text-white focus:outline-none"
            data-testid="edit-status"
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Reward */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Reward ($FNDRY)</label>
          <input
            type="number"
            min={1}
            value={reward}
            onChange={e => setReward(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#9945FF]/50"
            data-testid="edit-reward"
          />
        </div>

        {update.isError && (
          <p className="text-xs text-red-400">{(update.error as Error).message}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={update.isPending}
            className="flex-1 rounded-lg bg-[#9945FF]/20 text-[#9945FF] py-1.5 text-xs font-semibold hover:bg-[#9945FF]/30 disabled:opacity-50 transition-colors"
            data-testid="save-bounty-edit"
          >
            {update.isPending ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            onClick={handleClose}
            disabled={close.isPending}
            className="flex-1 rounded-lg bg-red-500/10 text-red-400 py-1.5 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            data-testid="close-bounty-btn"
          >
            {close.isPending ? 'Closing…' : 'Force Close'}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create bounty modal
// ---------------------------------------------------------------------------

function CreateBountyModal({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<1 | 2 | 3>(1);
  const [reward, setReward] = useState('');
  const create = useCreateBounty();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: BountyAdminCreate = {
      title: title.trim(),
      description: description.trim(),
      tier,
      reward_amount: Number(reward),
    };
    await create.mutateAsync(payload);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      data-testid="bounty-create-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#12121f] p-6 space-y-4"
      >
        <h3 className="text-sm font-semibold">Create Bounty</h3>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Title</label>
          <input
            required
            minLength={3}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Bounty title…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#9945FF]/50"
            data-testid="create-title"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Description</label>
          <textarea
            required
            minLength={10}
            rows={4}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Detailed requirements…"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#9945FF]/50 resize-none"
            data-testid="create-description"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Tier</label>
            <select
              value={tier}
              onChange={e => setTier(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full rounded-lg border border-white/10 bg-[#0a0a14] px-3 py-1.5 text-sm text-white focus:outline-none"
              data-testid="create-tier"
            >
              <option value={1}>T1 — Starter</option>
              <option value={2}>T2 — Standard</option>
              <option value={3}>T3 — Advanced</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Reward ($FNDRY)</label>
            <input
              required
              type="number"
              min={1}
              value={reward}
              onChange={e => setReward(e.target.value)}
              placeholder="500"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#9945FF]/50"
              data-testid="create-reward"
            />
          </div>
        </div>

        {create.isError && (
          <p className="text-xs text-red-400">{(create.error as Error).message}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={create.isPending}
            className="flex-1 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            data-testid="create-bounty-submit"
          >
            {create.isPending ? 'Creating…' : 'Create Bounty'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function BountyManagement() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<BountyAdminItem | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, error } = useAdminBounties({
    search: search || undefined,
    status: statusFilter || undefined,
    page,
    perPage: 20,
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="p-6 space-y-4" data-testid="bounty-management">
      {editing && <EditModal bounty={editing} onClose={() => setEditing(null)} />}
      {creating && <CreateBountyModal onClose={() => setCreating(false)} />}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bounty Management</h2>
        <div className="flex items-center gap-3">
          {data && <span className="text-xs text-gray-500">{data.total} total</span>}
          <button
            onClick={() => setCreating(true)}
            className="rounded-lg bg-[#9945FF]/20 text-[#9945FF] px-3 py-1.5 text-xs font-semibold hover:bg-[#9945FF]/30 transition-colors"
            data-testid="new-bounty-btn"
          >
            + New Bounty
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search title…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9945FF]/50 w-56"
          data-testid="bounty-search-input"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-white/10 bg-[#0a0a14] px-3 py-1.5 text-sm text-white focus:outline-none"
          data-testid="bounty-status-filter"
        >
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
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
        <p className="text-sm text-gray-500 text-center py-12">No bounties found</p>
      )}

      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-xs" data-testid="bounty-table">
            <thead>
              <tr className="border-b border-white/5 text-gray-500">
                <th className="text-left px-4 py-3 font-medium">Title</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-right px-4 py-3 font-medium">Reward</th>
                <th className="text-right px-4 py-3 font-medium">Submissions</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(b => (
                <tr
                  key={b.id}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  data-testid={`bounty-row-${b.id}`}
                >
                  <td className="px-4 py-3 font-medium truncate max-w-[240px]">{b.title}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[b.status] ?? 'text-gray-400 bg-white/5'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">T{b.tier}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#14F195]">
                    {b.reward_amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                    {b.submission_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(b)}
                      className="text-[#9945FF] hover:text-[#9945FF]/70 text-[10px] underline"
                      data-testid={`edit-bounty-${b.id}`}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
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
