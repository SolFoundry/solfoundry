/**
 * Admin Contributors Management Page
 * Approve, ban, view history and notes for contributors.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  getContributors,
  approveContributor,
  banContributor,
  updateContributorNotes,
  type AdminContributor,
  type ContributorStatus,
  type ContributorTier,
} from '../api/index.js';

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<ContributorStatus, string> = {
  active:         '#22c55e',
  banned:         '#ef4444',
  suspended:      '#f59e0b',
  pending_review: '#6366f1',
};

const TIER_COLORS: Record<ContributorTier, string> = {
  T1: '#94a3b8',
  T2: '#6366f1',
  T3: '#f59e0b',
};

function fmtFND(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Ban Modal ─────────────────────────────────────────────────────────────────

interface BanModalProps {
  contributor: AdminContributor;
  onClose: () => void;
  onBanned: (c: AdminContributor) => void;
}

const BanModal: React.FC<BanModalProps> = ({ contributor: c, onClose, onBanned }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { setError('Ban reason is required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const updated = await banContributor(c.id, reason.trim());
      onBanned(updated);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
        <h2 style={{ margin: '0 0 8px', color: '#ef4444' }}>⛔ Ban @{c.githubHandle}</h2>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
          The contributor will be unable to claim or submit work. Provide a clear reason.
        </p>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <textarea
            required
            rows={4}
            placeholder="Reason for ban…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }}
          />
          {error && <div style={{ color: '#ef4444', marginBottom: 12, fontSize: 13 }}>⚠️ {error}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: '8px 16px', background: '#ef4444', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {saving ? 'Banning…' : 'Confirm Ban'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Detail Modal ──────────────────────────────────────────────────────────────

interface DetailModalProps {
  contributor: AdminContributor;
  onClose: () => void;
  onUpdated: (c: AdminContributor) => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ contributor: c, onClose, onUpdated }) => {
  const [notes, setNotes] = useState(c.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      const updated = await updateContributorNotes(c.id, notes);
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000099', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#1e293b', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', color: '#f1f5f9' }}>@{c.githubHandle}</h2>
            <span style={{ fontSize: 13, color: STATUS_COLORS[c.status] }}>{c.status.replace('_', ' ')}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Tier',            value: c.tier,                           color: TIER_COLORS[c.tier] },
            { label: 'Reputation',      value: c.reputation.toLocaleString(),    color: '#e2e8f0' },
            { label: 'Completed',       value: c.bountiesCompleted,             color: '#22c55e' },
            { label: 'In Progress',     value: c.bountiesInProgress,            color: '#6366f1' },
            { label: 'Total Earned',    value: `${fmtFND(c.totalEarned)} $FNDRY`, color: '#f59e0b' },
            { label: 'Joined',          value: fmtDate(c.joinedAt),             color: '#94a3b8' },
            { label: 'Last Active',     value: fmtDate(c.lastActiveAt),         color: '#94a3b8' },
            ...(c.walletAddress ? [{ label: 'Wallet', value: `${c.walletAddress.slice(0, 8)}…`, color: '#94a3b8' }] : []),
          ].map((item) => (
            <div key={item.label} style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: item.color }}>{item.value}</div>
            </div>
          ))}
        </div>

        {c.banReason && (
          <div style={{ background: '#ef444422', border: '1px solid #ef444444', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>Ban reason</div>
            <div style={{ fontSize: 13, color: '#fca5a5' }}>{c.banReason}</div>
          </div>
        )}

        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>Admin Notes</label>
          <textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes about this contributor…"
            style={{ width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 }}
          />
          <button
            onClick={() => void handleSaveNotes()}
            disabled={saving}
            style={{ padding: '6px 16px', background: '#6366f1', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13 }}
          >
            {saving ? 'Saving…' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Contributors Page ─────────────────────────────────────────────────────────

export const ContributorsPage: React.FC = () => {
  const [contributors, setContributors] = useState<AdminContributor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContributorStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminContributor | null>(null);
  const [detailTarget, setDetailTarget] = useState<AdminContributor | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getContributors({
        page,
        status:  statusFilter || undefined,
        search:  search || undefined,
      });
      setContributors(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      const updated = await approveContributor(id);
      setContributors((prev) => prev.map((c) => c.id === id ? updated : c));
    } finally {
      setActionId(null);
    }
  };

  const updateContributor = (updated: AdminContributor) => {
    setContributors((prev) => prev.map((c) => c.id === updated.id ? updated : c));
    setBanTarget(null);
    setDetailTarget(null);
  };

  return (
    <div>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, color: '#f1f5f9' }}>👥 Contributor Management</h1>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by handle…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 6, color: '#e2e8f0', width: 200 }}
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as ContributorStatus | ''); setPage(1); }}
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
              {['Contributor', 'Tier', 'Status', 'Reputation', 'Completed', 'Earned', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            )}
            {!loading && contributors.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '10px 14px' }}>
                  <button
                    onClick={() => setDetailTarget(c)}
                    style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline', textDecorationColor: '#334155' }}
                  >
                    @{c.githubHandle}
                  </button>
                </td>
                <td style={{ padding: '10px 14px', color: TIER_COLORS[c.tier], fontWeight: 600 }}>{c.tier}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ color: STATUS_COLORS[c.status], fontWeight: 500, fontSize: 12, textTransform: 'capitalize' }}>
                    {c.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#e2e8f0' }}>{c.reputation}</td>
                <td style={{ padding: '10px 14px', color: '#22c55e' }}>{c.bountiesCompleted}</td>
                <td style={{ padding: '10px 14px', color: '#f59e0b', fontWeight: 600 }}>{fmtFND(c.totalEarned)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {c.status === 'pending_review' && (
                      <button
                        disabled={actionId === c.id}
                        onClick={() => void handleApprove(c.id)}
                        style={{ padding: '4px 10px', background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e44', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Approve
                      </button>
                    )}
                    {c.status === 'active' && (
                      <button
                        onClick={() => setBanTarget(c)}
                        style={{ padding: '4px 10px', background: '#ef444422', color: '#ef4444', border: '1px solid #ef444444', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                      >
                        Ban
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
        <span>Showing {contributors.length} of {total}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>← Prev</button>
          <span style={{ padding: '4px 8px' }}>Page {page}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={contributors.length < 20}
            style={{ padding: '4px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', cursor: 'pointer' }}>Next →</button>
        </div>
      </div>

      {banTarget && (
        <BanModal
          contributor={banTarget}
          onClose={() => setBanTarget(null)}
          onBanned={updateContributor}
        />
      )}
      {detailTarget && (
        <DetailModal
          contributor={detailTarget}
          onClose={() => setDetailTarget(null)}
          onUpdated={updateContributor}
        />
      )}
    </div>
  );
};

export default ContributorsPage;
