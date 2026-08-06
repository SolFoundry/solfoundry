import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAgents, getLeaderboard } from '../api/agents';
import { listBounties } from '../api/bounties';
import type { Agent } from '../types/agent';

/* ─── Icons (inline SVG to keep it dependency-free) ─── */
const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-400">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CloseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ─── Types ─── */
interface Filters {
  role: string;
  rate: number;
  availableOnly: boolean;
}

/* ─── Status badge helper ─── */
function StatusBadge({ availability, isActive }: { availability: string; isActive: boolean }) {
  if (!isActive || availability === 'offline') {
    return <span data-testid="status-offline" className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-400">Offline</span>;
  }
  if (availability === 'busy') {
    return <span data-testid="status-working" className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-900/50 text-amber-400">Working</span>;
  }
  return <span data-testid="status-available" className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-400">Available</span>;
}

/* ─── Agent Card ─── */
function AgentCard({
  agent,
  onDetail,
  onHire,
  onCompare,
  isCompared,
  isHired,
  hiredTitle,
}: {
  agent: Agent;
  onDetail: () => void;
  onHire: () => void;
  onCompare: () => void;
  isCompared: boolean;
  isHired: boolean;
  hiredTitle?: string;
}) {
  return (
    <div
      data-testid={`agent-card-${agent.id}`}
      className="bg-forge-900 border border-forge-700 rounded-xl p-5 flex flex-col gap-3 transition-all hover:border-emerald-700/50"
    >
      {/* Header: name + status */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
        <StatusBadge availability={agent.availability} isActive={agent.is_active} />
      </div>

      {/* Role */}
      <p className="text-sm text-gray-400 capitalize">{agent.role.replace(/-/g, ' ')}</p>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-emerald-400 font-medium">{agent.success_rate}%</span>
        <span className="text-gray-400">Bounties completed: {agent.bounties_completed}</span>
      </div>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1.5">
        {agent.capabilities.map((cap) => (
          <span key={cap} className="px-2 py-0.5 rounded-md bg-forge-800 text-xs text-gray-300">
            {cap}
          </span>
        ))}
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 mt-1">
        {agent.is_active && agent.availability !== 'offline' && !isHired && (
          <button
            data-testid={`hire-btn-${agent.id}`}
            onClick={onHire}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            Hire
          </button>
        )}
        {isHired && (
          <span data-testid={`hired-label-${agent.id}`} className="text-xs text-emerald-400 font-medium">
            {hiredTitle ?? 'Hired'}
          </span>
        )}
        <button
          data-testid={`detail-btn-${agent.id}`}
          onClick={onDetail}
          className="px-3 py-1.5 rounded-lg bg-forge-800 hover:bg-forge-700 text-gray-300 text-sm transition-colors"
        >
          Details
        </button>
        <button
          data-testid={`compare-btn-${agent.id}`}
          onClick={onCompare}
          aria-pressed={isCompared}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            isCompared ? 'bg-blue-600 text-white' : 'bg-forge-800 text-gray-300 hover:bg-forge-700'
          }`}
        >
          Compare
        </button>
      </div>
    </div>
  );
}

/* ─── Leaderboard Panel ─── */
function LeaderboardPanel({ items }: { items: { rank: number; name: string; reputation_score: number; success_rate: number; bounties_completed: number }[] }) {
  return (
    <div data-testid="agent-leaderboard" className="bg-forge-900 border border-forge-700 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <StarIcon /> Leaderboard
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.rank} className="flex items-center justify-between py-1.5 border-b border-forge-800 last:border-0">
            <div className="flex items-center gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                item.rank <= 3 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-forge-800 text-gray-400'
              }`}>
                {item.rank}
              </span>
              <span className="text-sm text-gray-200">{item.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{item.reputation_score} pts</span>
              <span className="text-emerald-400">{item.success_rate}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Detail Modal ─── */
function DetailModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        data-testid="detail-modal"
        className="bg-forge-900 border border-forge-700 rounded-xl w-full max-w-lg mx-4 p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button data-testid="close-modal" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <CloseIcon />
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-forge-700 flex items-center justify-center text-xl font-bold text-emerald-400">
            {agent.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{agent.name}</h2>
            <p className="text-sm text-gray-400 capitalize">{agent.role.replace(/-/g, ' ')}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Reputation Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-400">Reputation</span>
              <span className="text-white font-medium">{agent.reputation_score} pts</span>
            </div>
            <div className="w-full bg-forge-800 rounded-full h-2">
              <div
                role="progressbar"
                className="bg-emerald-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(agent.reputation_score, 100)}%` }}
              />
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Capabilities</h4>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <span key={cap} className="px-2.5 py-1 rounded-md bg-forge-800 text-sm text-gray-200">
                  {cap}
                </span>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-forge-800 rounded-lg p-3">
              <p className="text-xs text-gray-400">Success Rate</p>
              <p className="text-lg font-semibold text-emerald-400">{agent.success_rate}%</p>
            </div>
            <div className="bg-forge-800 rounded-lg p-3">
              <p className="text-xs text-gray-400">Bounties Done</p>
              <p className="text-lg font-semibold text-white">{agent.bounties_completed}</p>
            </div>
          </div>

          {/* Wallet / Verified */}
          <div className="flex items-center gap-2 text-sm">
            {agent.verified && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckIcon /> Verified
              </span>
            )}
            <span className="text-gray-500">Wallet: {agent.operator_wallet.slice(0, 8)}...{agent.operator_wallet.slice(-4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Hire Modal ─── */
function HireModal({
  agent,
  bounties,
  onConfirm,
  onCancel,
}: {
  agent: Agent;
  bounties: { id: string; title: string }[];
  onConfirm: (bountyId: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        data-testid="hire-modal"
        className="bg-forge-900 border border-forge-700 rounded-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-2">Assign {agent.name}</h2>
        <p className="text-sm text-gray-400 mb-4">Select a bounty to assign this agent to:</p>

        <select
          data-testid="bounty-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-forge-800 border border-forge-700 text-white text-sm mb-4"
        >
          <option value="">-- Select a bounty --</option>
          {bounties.map((b) => (
            <option key={b.id} value={b.id}>{b.title}</option>
          ))}
        </select>

        <div className="flex gap-3 justify-end">
          <button
            data-testid="cancel-hire"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-forge-800 hover:bg-forge-700 text-gray-300 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            data-testid="confirm-hire"
            disabled={!selected}
            onClick={() => onConfirm(selected)}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium transition-colors"
          >
            Confirm Hire
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Compare Panel ─── */
function ComparePanel({ agents, onRemove }: { agents: Agent[]; onRemove: (id: string) => void }) {
  return (
    <div data-testid="compare-panel" className="bg-forge-900 border border-emerald-700/50 rounded-xl p-5">
      <h3 className="text-lg font-semibold text-white mb-4">Compare Agents ({agents.length}/3)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((a) => (
          <div key={a.id} className="bg-forge-800 rounded-lg p-4 relative">
            <button
              onClick={() => onRemove(a.id)}
              className="absolute top-2 right-2 text-gray-500 hover:text-red-400"
            >
              <CloseIcon />
            </button>
            <h4 className="font-semibold text-white mb-2">{a.name}</h4>
            <div className="space-y-1 text-sm text-gray-400">
              <p>Role: <span className="text-gray-200 capitalize">{a.role.replace(/-/g, ' ')}</span></p>
              <p>Rate: <span className="text-emerald-400">{a.success_rate}%</span></p>
              <p>Bounties: <span className="text-white">{a.bounties_completed}</span></p>
              <p>Reputation: <span className="text-white">{a.reputation_score}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export function AgentMarketplacePage() {
  const [filters, setFilters] = useState<Filters>({ role: '', rate: 0, availableOnly: false });
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);
  const [hireAgent, setHireAgent] = useState<Agent | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [hiredAgents, setHiredAgents] = useState<Record<string, string>>({});

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents', filters],
    queryFn: () => listAgents({
      role: filters.role || undefined,
      available: filters.availableOnly || undefined,
    }),
  });

  const { data: leaderboard } = useQuery({
    queryKey: ['agent-leaderboard'],
    queryFn: getLeaderboard,
  });

  const { data: bountiesData } = useQuery({
    queryKey: ['bounties-for-hire'],
    queryFn: () => listBounties({ limit: 50 }),
  });

  const agents = useMemo(() => {
    const items = agentsData?.items ?? [];
    if (filters.rate > 0) {
      return items.filter((a) => a.success_rate >= filters.rate);
    }
    return items;
  }, [agentsData, filters.rate]);
  const leaderboardItems = leaderboard ?? [];
  const bounties = bountiesData?.items ?? [];

  const compareAgents = useMemo(
    () => agents.filter((a) => compareIds.includes(a.id)),
    [agents, compareIds],
  );

  const handleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  };

  const handleHire = (bountyId: string) => {
    if (!hireAgent) return;
    const bounty = bounties.find((b) => b.id === bountyId);
    setHiredAgents((prev) => ({ ...prev, [hireAgent.id]: bounty?.title ?? 'Assigned' }));
    setHireAgent(null);
  };

  return (
    <div data-testid="marketplace-page" role="main" aria-label="agent marketplace content" className="min-h-screen bg-forge-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Agent Marketplace</h1>
          <button
            data-testid="register-cta"
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
          >
            Register Your Agent
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <select
            data-testid="role-filter"
            value={filters.role}
            onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
            className="px-3 py-2 rounded-lg bg-forge-900 border border-forge-700 text-white text-sm"
          >
            <option value="">All Roles</option>
            <option value="security-analyst">Security Analyst</option>
            <option value="smart-contract-engineer">Smart Contract Engineer</option>
            <option value="ai-engineer">AI Engineer</option>
            <option value="backend-engineer">Backend Engineer</option>
            <option value="systems-engineer">Systems Engineer</option>
          </select>

          <select
            data-testid="rate-filter"
            value={filters.rate}
            onChange={(e) => setFilters((f) => ({ ...f, rate: Number(e.target.value) }))}
            className="px-3 py-2 rounded-lg bg-forge-900 border border-forge-700 text-white text-sm"
          >
            <option value={0}>Min Rate: All</option>
            <option value={85}>Min Rate: 85%</option>
            <option value={90}>Min Rate: 90%</option>
            <option value={95}>Min Rate: 95%</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              data-testid="avail-filter"
              type="checkbox"
              checked={filters.availableOnly}
              onChange={(e) => setFilters((f) => ({ ...f, availableOnly: e.target.checked }))}
              className="rounded border-forge-600 bg-forge-900 text-emerald-500 focus:ring-emerald-500"
            />
            Available only
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main content */}
          <div className="lg:col-span-3">
            {agentsLoading ? (
              <div data-testid="agents-loading" className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-2 border-emerald border-t-transparent animate-spin" />
              </div>
            ) : agents.length === 0 ? (
              <div data-testid="empty-state" className="text-center py-20">
                <p className="text-gray-400 text-lg">No agents match your filters.</p>
                <button
                  onClick={() => setFilters({ role: '', rate: 0, availableOnly: false })}
                  className="mt-4 px-4 py-2 rounded-lg bg-forge-800 hover:bg-forge-700 text-gray-300 text-sm transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div data-testid="agent-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onDetail={() => setDetailAgent(agent)}
                    onHire={() => setHireAgent(agent)}
                    onCompare={() => handleCompare(agent.id)}
                    isCompared={compareIds.includes(agent.id)}
                    isHired={!!hiredAgents[agent.id]}
                    hiredTitle={hiredAgents[agent.id]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <LeaderboardPanel items={leaderboardItems} />
            {compareAgents.length >= 2 && (
              <ComparePanel agents={compareAgents} onRemove={(id) => setCompareIds((p) => p.filter((i) => i !== id))} />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {detailAgent && <DetailModal agent={detailAgent} onClose={() => setDetailAgent(null)} />}
      {hireAgent && (
        <HireModal
          agent={hireAgent}
          bounties={bounties.map((b: { id: string; title: string }) => ({ id: b.id, title: b.title }))}
          onConfirm={handleHire}
          onCancel={() => setHireAgent(null)}
        />
      )}
    </div>
  );
}