/**
 * Admin Bounties Management Page
 * Create, update, close bounties; approve/reject submissions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  getBounties,
  updateBounty,
  closeBounty,
  createBounty,
  type AdminBounty,
  type BountyStatus,
  type ContributorTier,
  type CreateBountyInput,
} from '../api/index.js';

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<BountyStatus, string> = {
  draft:        '#64748b',
  open:         '#22c55e',
  in_progress:  '#6366f1',
  under_review: '#f59e0b',
  completed:    '#06b6d4',
  cancelled:    '#94a3b8',
  disputed:     '#ef4444',
};

const TIER_COLORS: Record<ContributorTier, string> = {
  T1: '#94a3b8',
  T2: '#6366f1',
  T3: '#f59e0b',
};

function StatusBadge({ status }: { status: BountyStatus }) {
  const color = STATUS_COLORS[status] ?? '#94a3b8';
  return (
    <span style={{
      background: `${color}22`, color, borderRadius: 4,
      padding: '2px 8px', fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
    }}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ── Create Bounty Modal ────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: (b: AdminBounty) => void;
}

const CreateBountyModal: React.FC<CreateModalProps> = ({ onClose, onCreated }) => {
  const [form, setForm] = useState<CreateBountyInput>({
    title: '', description: '', reward: 100000, rewardToken: '$FNDRY',
    tier: 'T2', tags: [], issueUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof CreateBountyInput, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createBounty(form);
      onCreated(created);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: '#00000099', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 100,
  };
  const modal: React.CSSProperties = {
    background: '#1e293b', borderRadius: 16, padding: 32, width: '100%',
    maxWidth: 520, maxHeight: '90vh', overflowY: 'auto',
  };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <h2 style={{ margin: '0 0 20px', color: '#f1f5f9' }}>Create New Bounty</h2>
        <form onSubmit={(e) => void handleSubmit(e)}>
          {[
            { label: 'Title', key: 'title' as const, type: 'text' },
            { label: 'Issue URL', key: 'issueUrl' as const, type: 'url' },
          ].map(({ label, key, type }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>{label}</label>
              <input
                type={type}
                required
                value={form[key] as string}
                onChange={(e) => set(key, e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Description</label>
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Reward ($FNDRY)</label>
              <input
                type="number"
                min={1}
                value={form.reward}
                onChange={(e) => set('reward', Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Tier</label>
              <select
                value={form.tier}
                onChange={(e) => set('tier', e.target.value as ContributorTier)}
                style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', boxSizing: 'border-box' }}
              >
                {(['T1', 'T2', 'T3'] as ContributorTier[]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Tags (comma-separated)</label>
            <input
              type="text"
              placeholder="typescript, react, solana"
              value={form.tags.join(', ')}
              onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', boxSizing: 'border-box' }}
            />
          </div>

          {error && <div style={{ color: '#ef4444', marginBottom: 16, fontSize: 13 }}>⚠️ {error}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 18px', background: '#334155', border: 'none', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '8px 18px', background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {saving ? 'Creating…' : 'Create Bounty'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Bounties Page ──────────────────────────────────────────────────────────────

export const BountiesPage: React.FC = () => {
  const [bounties, setBounties] = useState<AdminBounty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BountyStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBounties({ page, status: statusFilter || undefined, search: search || undefined });
      setBounties(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { void load(); }, [load]);

  const handleStatusChange = async (id: string, status: BountyStatus) => {
    setActionId(id);
    try {
      const updated = await updateBounty(id, { status });
      setBounties((prev) => prev.map((b) => b.id === id ? updated : b));
    } finally {
      setActionId(null);
    }
  };

  const handleClose = async (id: string) => {
    if (!confirm('Close this bounty? This cannot be undone.')) return;
    setActionId(id);
    try {
      const updated = await closeBounty(id);
      setBounties((prev) => prev.map((b) => b.id === id ? updated : b));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#f1f5f9' }}>🏆 Bounty Management</h1>
        <button
          onClick={() => setShowCreate(true)}
          style={{ padding: '8px 20px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >
          + New Bounty
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search bounties…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', width: 220 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as BountyStatus | ''); setPage(1); }}
          style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0' }}
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ background: '#1e293b', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#0f172a' }}>
              {['Issue', 'Title', 'Tier', 'Reward', 'Status', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            )}
            {!loading && bounties.map((b) => (
              <tr key={b.id} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '10px 14px', color: '#64748b' }}>#{b.issueNumber}</td>
                <td style={{ padding: '10px 14px', color: '#e2e8f0', maxWidth: 300 }}>
                  <div style={{ fontWeight: 500 }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{b.tags.slice(0, 3).join(', ')}</div>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ color: TIER_COLORS[b.tier], fontWeight: 600 }}>{b.tier}</span>
                </td>
                <td style={{ padding: '10px 14px', color: '#f59e0b', fontWeight: 600 }}>
                  {b.reward.toLocaleString()}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <StatusBadge status={b.status} />
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {b.status === 'open' && (
                      <button
                        disabled={actionId === b.id}
                        onClick={() => void handleClose(b.id)}
                        style={{ padding: '4px 10px', background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Close
                      </button>
                    )}
                    {b.status === 'under_review' && (
                      <button
                        disabled={actionId === b.id}
                        onClick={() => void handleStatusChange(b.id, 'completed')}
                        style={{ padding: '4px 10px', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, color: '#94a3b8', fontSize: 13 }}>
        <span>Showing {bounties.length} of {total}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>
            ← Prev
          </button>
          <span style={{ padding: '4px 8px' }}>Page {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={bounties.length < 20}
            style={{ padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>
            Next →
          </button>
        </div>
      </div>

      {showCreate && (
        <CreateBountyModal
          onClose={() => setShowCreate(false)}
          onCreated={(b) => { setBounties((prev) => [b, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
  );
};

export default BountiesPage;
