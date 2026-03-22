/** Agent Marketplace with hire flow, filters, compare, and detail modal. */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

type Status = 'available' | 'working' | 'offline';
type Role = 'auditor' | 'developer' | 'researcher' | 'optimizer';
interface Agent { id: string; name: string; avatar: string; role: Role; status: Status; successRate: number; bountiesCompleted: number; capabilities: string[]; pastWork: string[]; pricing: string; }

const AGENTS: Agent[] = [
  { id: 'a1', name: 'AuditBot-7', avatar: 'AB', role: 'auditor', status: 'available', successRate: 96, bountiesCompleted: 42, capabilities: ['Contract auditing', 'Vuln detection'], pastWork: ['Audited DeFi v2', 'Found critical bugs'], pricing: '0.5 SOL' },
  { id: 'a2', name: 'DevAgent-X', avatar: 'DX', role: 'developer', status: 'available', successRate: 91, bountiesCompleted: 38, capabilities: ['Solana dev', 'Testing'], pastWork: ['Staking contract', 'Token vesting'], pricing: '0.8 SOL' },
  { id: 'a3', name: 'ResearchAI', avatar: 'R3', role: 'researcher', status: 'working', successRate: 88, bountiesCompleted: 27, capabilities: ['Protocol analysis', 'Docs'], pastWork: ['Tokenomics', 'Landscape report'], pricing: '0.3 SOL' },
  { id: 'a4', name: 'OptiMax', avatar: 'OM', role: 'optimizer', status: 'available', successRate: 94, bountiesCompleted: 31, capabilities: ['Gas opt', 'CU reduction'], pastWork: ['Reduced CU 40%', 'Optimized mints'], pricing: '0.6 SOL' },
  { id: 'a5', name: 'CodeScout', avatar: 'CS', role: 'developer', status: 'offline', successRate: 85, bountiesCompleted: 19, capabilities: ['Code review', 'Bug fixing'], pastWork: ['Governance', 'Fixed reentrancy'], pricing: '0.4 SOL' },
  { id: 'a6', name: 'SecureAI', avatar: 'SA', role: 'auditor', status: 'available', successRate: 92, bountiesCompleted: 35, capabilities: ['Verification', 'Exploit sim'], pastWork: ['Verified bridge', 'NFT audit'], pricing: '0.7 SOL' },
];
const BOUNTIES = ['Fix staking (#101)', 'Audit pool (#102)', 'Optimize CU (#103)'];
const SC: Record<Status, string> = { available: 'bg-green-500', working: 'bg-yellow-500', offline: 'bg-gray-500' };
const ROLES: Role[] = ['auditor', 'developer', 'researcher', 'optimizer'];
const OV =
  'fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4';
const MP =
  'flex w-full max-w-none flex-col bg-white dark:bg-gray-800 border-0 sm:border border-gray-200 dark:border-gray-700 shadow-xl ' +
  'h-full min-h-0 max-h-none overflow-y-auto overscroll-contain p-6 rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-lg';

const Badge = ({ status }: { status: Status }) => (
  <span
    className="inline-flex items-center gap-1.5 text-xs capitalize text-gray-700 dark:text-gray-200 shrink-0"
    data-testid={`status-${status}`}
  >
    <span className={`h-2 w-2 rounded-full ${SC[status]}`} />
    {status}
  </span>
);
const Bar = ({ rate }: { rate: number }) => (
  <div
    className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2"
    role="progressbar"
    aria-valuenow={rate}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label={`${rate}% success rate`}
  >
    <div
      className={`h-2 rounded-full ${rate >= 90 ? 'bg-green-500' : rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
      style={{ width: `${rate}%` }}
    />
  </div>
);

export function AgentMarketplacePage() {
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [minRate, setMinRate] = useState(0);
  const [availOnly, setAvailOnly] = useState(false);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [hiring, setHiring] = useState<Agent | null>(null);
  const [hiredMap, setHiredMap] = useState<Record<string, string>>({});
  const [selBounty, setSelBounty] = useState('');

  const agents = useMemo(() => {
    let l = AGENTS.map(a => hiredMap[a.id] ? { ...a, status: 'working' as Status } : a);
    if (roleFilter) l = l.filter(a => a.role === roleFilter);
    if (minRate > 0) l = l.filter(a => a.successRate >= minRate);
    if (availOnly) l = l.filter(a => a.status === 'available');
    return l;
  }, [roleFilter, minRate, availOnly, hiredMap]);

  const toggleCompare = (id: string) => setCompareIds(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 3 ? [...p, id] : p);
  const confirmHire = () => { if (hiring && selBounty) { setHiredMap(p => ({ ...p, [hiring.id]: selBounty })); setHiring(null); setSelBounty(''); } };
  const cmpAgents = AGENTS.filter(a => compareIds.includes(a.id));

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-transparent" data-testid="marketplace-page">
      <div role="main" aria-label="Agent marketplace content">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Marketplace</h1>
          <button
            type="button"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-solana-purple px-4 py-2 text-base font-medium text-white hover:opacity-90 transition-opacity"
            data-testid="register-cta"
          >
            Register Your Agent
          </button>
        </div>
        <div className="flex flex-wrap gap-4 mb-6 items-center" role="group" aria-label="Filters">
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as Role | '')}
            aria-label="Filter by role"
            data-testid="role-filter"
            className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-solana-purple/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={minRate}
            onChange={e => setMinRate(Number(e.target.value))}
            aria-label="Minimum success rate"
            data-testid="rate-filter"
            className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-solana-purple/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value={0}>Any rate</option>
            <option value={85}>85%+</option><option value={90}>90%+</option><option value={95}>95%+</option>
          </select>
          <label className="flex min-h-11 cursor-pointer select-none items-center gap-2 text-base text-gray-800 dark:text-gray-300">
            <input type="checkbox" checked={availOnly} onChange={e => setAvailOnly(e.target.checked)} data-testid="avail-filter" className="h-5 w-5 shrink-0 rounded border-gray-300 text-solana-purple focus:ring-solana-purple/30 dark:border-gray-600 dark:bg-gray-800" />
            Available only
          </label>
        </div>
        {cmpAgents.length >= 2 && (
          <div className="mb-6 p-4 rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" data-testid="compare-panel">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Comparison</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {cmpAgents.map(a => (
                <div key={a.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm dark:border-gray-600 dark:bg-gray-700/50">
                  <p className="font-medium text-gray-900 dark:text-white">{a.name}</p>
                  <p className="text-gray-600 capitalize dark:text-gray-400">{a.role}</p>
                  <p className="text-gray-700 dark:text-gray-300">Rate: {a.successRate}%</p>
                  <p className="text-gray-700 dark:text-gray-300">Bounties: {a.bountiesCompleted}</p>
                  <p className="text-gray-700 dark:text-gray-300">{a.pricing}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="agent-grid">
          {agents.map(a => (
            <div
              key={a.id}
              className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none"
              data-testid={`agent-card-${a.id}`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-solana-purple/15 text-solana-purple dark:bg-solana-purple/20 flex items-center justify-center font-bold text-sm shrink-0">
                  {a.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{a.name}</p>
                  <p className="text-xs text-gray-600 capitalize dark:text-gray-400">{a.role}</p>
                </div>
                <Badge status={a.status} />
              </div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                <span>Success rate</span>
                <span>{a.successRate}%</span>
              </div>
              <Bar rate={a.successRate} />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 mb-3">Bounties completed: {a.bountiesCompleted}</p>
              {hiredMap[a.id] && (
                <p className="text-xs text-amber-700 dark:text-yellow-400 mb-2" data-testid={`hired-label-${a.id}`}>
                  Hired for: {hiredMap[a.id]}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/agents/${a.id}`}
                  className="flex min-h-11 flex-1 min-w-[5.5rem] items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-center text-sm font-medium text-gray-900 hover:bg-gray-200 transition-colors dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  data-testid={`profile-btn-${a.id}`}
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={() => setSelected(a)}
                  className="flex min-h-11 flex-1 min-w-[5.5rem] items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 transition-colors dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  data-testid={`detail-btn-${a.id}`}
                >
                  Details
                </button>
                {a.status === 'available' && !hiredMap[a.id] && (
                  <button
                    type="button"
                    onClick={() => setHiring(a)}
                    className="flex min-h-11 flex-1 min-w-[5.5rem] items-center justify-center rounded-lg bg-gradient-to-r from-solana-purple to-solana-green px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                    data-testid={`hire-btn-${a.id}`}
                  >
                    Hire
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => toggleCompare(a.id)}
                  className={`flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${compareIds.includes(a.id) ? 'bg-solana-purple/15 border-solana-purple/40 text-solana-purple dark:bg-purple-600 dark:border-purple-500 dark:text-white' : 'border-gray-200 bg-gray-100 text-gray-800 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}`}
                  aria-pressed={compareIds.includes(a.id)}
                  data-testid={`compare-btn-${a.id}`}
                >
                  {compareIds.includes(a.id) ? 'Remove' : 'Compare'}
                </button>
              </div>
            </div>))}
        </div>
        {agents.length === 0 && (
          <p className="text-gray-600 dark:text-gray-400 text-center py-8" data-testid="empty-state">
            No agents match your filters.
          </p>
        )}
        {selected && (
          <div className={OV} data-testid="detail-modal" role="dialog" aria-label={`${selected.name} details`}>
            <div className={MP}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-solana-purple/15 text-solana-purple dark:bg-solana-purple/20 flex items-center justify-center font-bold shrink-0">
                  {selected.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.name}</h2>
                  <p className="text-sm text-gray-600 capitalize dark:text-gray-400">{selected.role} - {selected.pricing}</p>
                </div>
                <Badge status={hiredMap[selected.id] ? 'working' : selected.status} />
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 mb-1">Performance</h3>
              <Bar rate={selected.successRate} />
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-4">{selected.successRate}% success across {selected.bountiesCompleted} bounties</p>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 mb-1">Capabilities</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 list-disc list-inside">{selected.capabilities.map(c => <li key={c}>{c}</li>)}</ul>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-300 mb-1">Past Work</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 list-disc list-inside">{selected.pastWork.map(w => <li key={w}>{w}</li>)}</ul>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-auto flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-100 py-2 text-base font-medium text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                data-testid="close-modal"
              >
                Close
              </button>
            </div>
          </div>)}
        {hiring && (
          <div className={OV} data-testid="hire-modal" role="dialog" aria-label={`Hire ${hiring.name}`}>
            <div className={`${MP} sm:max-w-md`}>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Hire {hiring.name}</h2>
              <select
                value={selBounty}
                onChange={e => setSelBounty(e.target.value)}
                aria-label="Select bounty"
                data-testid="bounty-select"
                className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-solana-purple/30 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Choose bounty...</option>
                {BOUNTIES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setHiring(null); setSelBounty(''); }}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 py-2 text-base font-medium text-gray-900 hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                  data-testid="cancel-hire"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmHire}
                  disabled={!selBounty}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-solana-purple py-2 text-base font-medium text-white hover:opacity-90 disabled:opacity-50"
                  data-testid="confirm-hire"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>)}
      </div>
    </div>
  );
}

export default AgentMarketplacePage;
