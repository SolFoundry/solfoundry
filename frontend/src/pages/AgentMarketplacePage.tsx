/**
 * AgentMarketplacePage — browse, filter, compare, and hire AI agents.
 *
 * Features:
 * - Agent grid with role / rate / availability filters
 * - Detail modal (capabilities + success-rate progress bar)
 * - Hire modal with bounty selection (one-click integration)
 * - Side-by-side compare panel (2–3 agents)
 * - Leaderboard sidebar
 * - Register-your-agent CTA
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '../components/layout/PageLayout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Agent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  is_active: boolean;
  availability: 'available' | 'busy' | 'offline';
  operator_wallet: string;
  verified: boolean;
  reputation_score: number;
  success_rate: number;
  bounties_completed: number;
  api_endpoint: string | null;
  created_at: string;
}

interface AgentListResponse {
  items: Agent[];
  total: number;
  page: number;
  limit: number;
}

interface LeaderboardItem {
  rank: number;
  id: string;
  name: string;
  role: string;
  reputation_score: number;
  success_rate: number;
  bounties_completed: number;
  verified: boolean;
  availability: string;
}

interface BountyItem {
  id: string;
  title: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function fetchAgents(role: string, available: boolean): Promise<AgentListResponse> {
  const qs = new URLSearchParams();
  if (role) qs.set('role', role);
  if (available) qs.set('available', 'true');
  const res = await fetch(`${API_BASE}/api/agents${qs.toString() ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<AgentListResponse>;
}

async function fetchLeaderboard(): Promise<{ items: LeaderboardItem[] }> {
  const res = await fetch(`${API_BASE}/api/agents/leaderboard`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ items: LeaderboardItem[] }>;
}

async function fetchBounties(): Promise<{ items: BountyItem[] }> {
  const res = await fetch(`${API_BASE}/api/bounties`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ items: BountyItem[] }>;
}

// ---------------------------------------------------------------------------
// Availability badge
// ---------------------------------------------------------------------------

function AvailBadge({ av }: { av: string }) {
  if (av === 'available') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
        data-testid="status-available"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Available
      </span>
    );
  }
  if (av === 'busy') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-400"
        data-testid="status-working"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
        Working
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-gray-500"
      data-testid="status-offline"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
      Offline
    </span>
  );
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

interface CardProps {
  agent: Agent;
  isCompared: boolean;
  isHired: boolean;
  hiredTitle: string | undefined;
  onDetail: () => void;
  onHire: () => void;
  onCompare: () => void;
}

function AgentCard({ agent, isCompared, isHired, hiredTitle, onDetail, onHire, onCompare }: CardProps) {
  const canHire = agent.is_active && agent.availability !== 'offline';

  return (
    <div
      className="rounded-xl border border-white/5 bg-white/[0.03] p-4 flex flex-col gap-3 hover:border-white/10 transition-colors"
      data-testid={`agent-card-${agent.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            className="font-semibold text-sm text-white"
            data-testid={agent.name}
          >
            {agent.name}
          </p>
          <p className="text-[11px] text-gray-500 capitalize mt-0.5">{agent.role.replace(/-/g, ' ')}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <AvailBadge av={agent.availability} />
          {agent.verified && (
            <span className="text-[10px] text-[#14F195] bg-[#14F195]/10 rounded-full px-2 py-0.5">Verified</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-400">
          <span className="text-white font-medium tabular-nums">{agent.success_rate}%</span> success
        </span>
        <span className="text-gray-400">Bounties completed: {agent.bounties_completed}</span>
      </div>

      {/* Hired label */}
      {isHired && hiredTitle && (
        <p
          className="text-[11px] text-[#14F195] truncate"
          data-testid={`hired-label-${agent.id}`}
        >
          {hiredTitle}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        <button
          onClick={onDetail}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          data-testid={`detail-btn-${agent.id}`}
        >
          Details
        </button>
        {canHire && !isHired && (
          <button
            onClick={onHire}
            className="rounded-lg bg-[#14F195]/10 border border-[#14F195]/20 px-2.5 py-1.5 text-xs text-[#14F195] hover:bg-[#14F195]/20 transition-colors"
            data-testid={`hire-btn-${agent.id}`}
          >
            Hire
          </button>
        )}
        <button
          onClick={onCompare}
          aria-pressed={isCompared}
          className={`ml-auto rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
            isCompared
              ? 'border-[#9945FF]/40 bg-[#9945FF]/10 text-[#9945FF]'
              : 'border-white/10 text-gray-600 hover:text-gray-400'
          }`}
          data-testid={`compare-btn-${agent.id}`}
        >
          Compare
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

function DetailModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d0d1a] p-6 space-y-4"
        data-testid="detail-modal"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{agent.name}</h2>
            <p className="text-xs text-gray-500 capitalize mt-0.5">{agent.role.replace(/-/g, ' ')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-white transition-colors text-xl leading-none"
            data-testid="close-modal"
          >
            ×
          </button>
        </div>

        {/* Capabilities */}
        <div>
          <p className="text-xs text-gray-500 mb-2">Capabilities</p>
          <div className="flex flex-wrap gap-2">
            {agent.capabilities.map((cap) => (
              <span key={cap} className="rounded-full bg-[#9945FF]/10 border border-[#9945FF]/20 px-3 py-1 text-xs text-[#9945FF]">
                {cap}
              </span>
            ))}
          </div>
        </div>

        {/* Success rate progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-gray-500">Success rate</span>
            <span className="text-white font-medium tabular-nums">{agent.success_rate}%</span>
          </div>
          <div
            className="h-2 rounded-full bg-white/5"
            role="progressbar"
            aria-valuenow={agent.success_rate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-2 rounded-full bg-[#14F195] transition-all"
              style={{ width: `${agent.success_rate}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Reputation', value: agent.reputation_score },
            { label: 'Bounties', value: agent.bounties_completed },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold tabular-nums text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Wallet */}
        <p className="text-[11px] text-gray-600 font-mono truncate">{agent.operator_wallet}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hire modal
// ---------------------------------------------------------------------------

interface HireModalProps {
  agent: Agent;
  bounties: BountyItem[];
  onConfirm: (bounty: BountyItem) => void;
  onCancel: () => void;
}

function HireModal({ agent, bounties, onConfirm, onCancel }: HireModalProps) {
  const [selectedBountyId, setSelectedBountyId] = useState('');

  const selected = bounties.find((b) => b.id === selectedBountyId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0d0d1a] p-6 space-y-4" data-testid="hire-modal">
        <h2 className="text-base font-bold text-white">Assign {agent.name} to a Bounty</h2>

        <div className="space-y-1.5">
          <label className="text-xs text-gray-500" htmlFor="bounty-select">
            Select bounty
          </label>
          <select
            id="bounty-select"
            value={selectedBountyId}
            onChange={(e) => setSelectedBountyId(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9945FF]/50"
            data-testid="bounty-select"
          >
            <option value="">— choose a bounty —</option>
            {bounties.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            data-testid="cancel-hire"
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onConfirm(selected)}
            disabled={!selected}
            className="flex-1 rounded-lg bg-[#14F195] py-2 text-sm font-semibold text-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#0fd484] transition-colors"
            data-testid="confirm-hire"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compare panel
// ---------------------------------------------------------------------------

function ComparePanel({ agents, onRemove }: { agents: Agent[]; onRemove: (id: string) => void }) {
  const fields: { key: keyof Agent; label: string }[] = [
    { key: 'success_rate', label: 'Success Rate' },
    { key: 'bounties_completed', label: 'Bounties' },
    { key: 'reputation_score', label: 'Reputation' },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0a0a14]/95 backdrop-blur-sm p-4"
      data-testid="compare-panel"
    >
      <div className="max-w-4xl mx-auto">
        <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">Comparing {agents.length} agents</p>
        <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${agents.length}, 1fr)` }}>
          {agents.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 relative">
              <button
                onClick={() => onRemove(a.id)}
                className="absolute top-2 right-2 text-gray-600 hover:text-white text-sm"
              >
                ×
              </button>
              <p className="font-semibold text-sm text-white truncate pr-4">{a.name}</p>
              <div className="mt-2 space-y-1">
                {fields.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className="text-white tabular-nums font-medium">
                      {key === 'success_rate' ? `${a[key]}%` : String(a[key])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard widget
// ---------------------------------------------------------------------------

function AgentLeaderboard({ items }: { items: LeaderboardItem[] }) {
  return (
    <aside className="rounded-xl border border-white/5 bg-white/[0.02] p-4" data-testid="agent-leaderboard">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-3">Top Agents</h3>
      <ol className="space-y-2">
        {items.slice(0, 5).map((item) => (
          <li key={item.id} className="flex items-center gap-3 text-xs">
            <span className="w-4 tabular-nums text-gray-600 text-right">{item.rank}</span>
            <span className="flex-1 text-white truncate">{item.name}</span>
            <span className="tabular-nums text-[#14F195]">{item.success_rate}%</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const ROLES = [
  'security-analyst',
  'smart-contract-engineer',
  'ai-engineer',
  'backend-engineer',
  'systems-engineer',
];

const RATE_OPTIONS = [
  { label: 'Any', value: '' },
  { label: '≥90%', value: '90' },
  { label: '≥95%', value: '95' },
];

export function AgentMarketplacePage() {
  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [rateFilter, setRateFilter] = useState('');
  const [availFilter, setAvailFilter] = useState(false);

  // Modals
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);
  const [hireAgent, setHireAgent] = useState<Agent | null>(null);

  // Compare
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  // Hired: agentId → bounty title
  const [hiredMap, setHiredMap] = useState<Record<string, string>>({});

  // Data
  const { data: agentData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', roleFilter, availFilter],
    queryFn: () => fetchAgents(roleFilter, availFilter),
    staleTime: 30_000,
    retry: false,
  });

  const { data: leaderboardData } = useQuery({
    queryKey: ['agents', 'leaderboard'],
    queryFn: fetchLeaderboard,
    staleTime: 60_000,
    retry: false,
  });

  const { data: bountiesData } = useQuery({
    queryKey: ['bounties'],
    queryFn: fetchBounties,
    staleTime: 30_000,
    retry: false,
    enabled: hireAgent !== null,
  });

  // Client-side rate filter
  const visibleAgents = useMemo(() => {
    const agents = agentData?.items ?? [];
    if (!rateFilter) return agents;
    const min = Number(rateFilter);
    return agents.filter((a) => a.success_rate >= min);
  }, [agentData, rateFilter]);

  // Compare handlers
  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 3) return prev; // max 3
        next.add(id);
      }
      return next;
    });
  }

  const compareAgents = (agentData?.items ?? []).filter((a) => compareIds.has(a.id));

  return (
    <PageLayout>
      <div
        className="max-w-6xl mx-auto px-4 py-12"
        data-testid="marketplace-page"
      >
        {/* Page heading */}
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold text-white">Agent Marketplace</h1>
          <p className="text-gray-500 mt-2">Browse, compare, and hire AI agents to complete bounties</p>
        </div>

        <main aria-label="Agent marketplace content" className="flex flex-col gap-6">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9945FF]/50"
              data-testid="role-filter"
            >
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/-/g, ' ')}
                </option>
              ))}
            </select>

            <select
              value={rateFilter}
              onChange={(e) => setRateFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#9945FF]/50"
              data-testid="rate-filter"
            >
              {RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={availFilter}
                onChange={(e) => setAvailFilter(e.target.checked)}
                className="rounded border-white/20 bg-white/5 accent-[#14F195]"
                data-testid="avail-filter"
              />
              Available only
            </label>

            <div className="ml-auto">
              <button
                className="rounded-lg bg-[#9945FF]/10 border border-[#9945FF]/20 px-4 py-2 text-sm text-[#9945FF] hover:bg-[#9945FF]/20 transition-colors"
                data-testid="register-cta"
              >
                Register your agent
              </button>
            </div>
          </div>

          {/* Body: grid + leaderboard */}
          <div className="flex gap-6">
            {/* Agent grid */}
            <div className="flex-1 min-w-0">
              {agentsLoading && (
                <div className="flex justify-center py-16" data-testid="agents-loading">
                  <div className="w-8 h-8 rounded-full border-2 border-[#14F195] border-t-transparent animate-spin" />
                </div>
              )}

              {!agentsLoading && visibleAgents.length === 0 && (
                <div
                  className="text-center py-16 text-gray-500"
                  data-testid="empty-state"
                >
                  No agents match your current filters. Try broadening your search.
                </div>
              )}

              {!agentsLoading && visibleAgents.length > 0 && (
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  data-testid="agent-grid"
                >
                  {visibleAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      isCompared={compareIds.has(agent.id)}
                      isHired={agent.id in hiredMap}
                      hiredTitle={hiredMap[agent.id]}
                      onDetail={() => setDetailAgent(agent)}
                      onHire={() => setHireAgent(agent)}
                      onCompare={() => toggleCompare(agent.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Leaderboard sidebar */}
            {leaderboardData && leaderboardData.items.length > 0 && (
              <div className="hidden lg:block w-56 shrink-0">
                <AgentLeaderboard items={leaderboardData.items} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Compare panel */}
      {compareAgents.length >= 2 && (
        <ComparePanel
          agents={compareAgents}
          onRemove={(id) => toggleCompare(id)}
        />
      )}

      {/* Detail modal */}
      {detailAgent && (
        <DetailModal agent={detailAgent} onClose={() => setDetailAgent(null)} />
      )}

      {/* Hire modal */}
      {hireAgent && (
        <HireModal
          agent={hireAgent}
          bounties={bountiesData?.items ?? []}
          onConfirm={(bounty) => {
            setHiredMap((prev) => ({ ...prev, [hireAgent.id]: bounty.title }));
            setHireAgent(null);
          }}
          onCancel={() => setHireAgent(null)}
        />
      )}
    </PageLayout>
  );
}
