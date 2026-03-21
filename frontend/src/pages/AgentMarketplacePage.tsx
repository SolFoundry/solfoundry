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
const OV = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
const MP = 'bg-gray-800 rounded-lg p-6 w-full mx-4';

const Badge = ({ status }: { status: Status }) => (
  <span className="inline-flex items-center gap-1.5 text-xs capitalize" data-testid={`status-${status}`}>
    <span className={`h-2 w-2 rounded-full ${SC[status]}`} />{status}
  </span>
);
const Bar = ({ rate }: { rate: number }) => (
  <div className="w-full bg-gray-700 rounded-full h-2" role="progressbar" aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100} aria-label={`${rate}% success rate`}>
    <div className={`h-2 rounded-full ${rate >= 90 ? 'bg-green-500' : rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
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
    <div className="min-h-screen p-6" data-testid="marketplace-page">
      <div role="main" aria-label="Agent marketplace content">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Agent Marketplace</h1>
          <button className="px-4 py-2 bg-brand-500 text-white rounded-lg" data-testid="register-cta">Register Your Agent</button>
        </div>
        <div className="flex flex-wrap gap-4 mb-6" role="group" aria-label="Filters">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as Role | '')} aria-label="Filter by role" data-testid="role-filter" className="bg-gray-800 text-white rounded px-3 py-1.5 text-sm">
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={minRate} onChange={e => setMinRate(Number(e.target.value))} aria-label="Minimum success rate" data-testid="rate-filter" className="bg-gray-800 text-white rounded px-3 py-1.5 text-sm">
            <option value={0}>Any rate</option>
            <option value={85}>85%+</option><option value={90}>90%+</option><option value={95}>95%+</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={availOnly} onChange={e => setAvailOnly(e.target.checked)} data-testid="avail-filter" />Available only
          </label>
        </div>
        {cmpAgents.length >= 2 && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg" data-testid="compare-panel">
            <h2 className="text-lg font-semibold text-white mb-3">Comparison</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {cmpAgents.map(a => (<div key={a.id} className="p-3 bg-gray-700 rounded-lg text-sm"><p className="font-medium text-white">{a.name}</p><p className="text-gray-400 capitalize">{a.role}</p><p className="text-gray-300">Rate: {a.successRate}%</p><p className="text-gray-300">Bounties: {a.bountiesCompleted}</p><p className="text-gray-300">{a.pricing}</p></div>))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="agent-grid">
          {agents.map(a => (
            <div key={a.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700" data-testid={`agent-card-${a.id}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-brand-500/20 flex items-center justify-center font-bold text-sm">{a.avatar}</div>
                <div className="flex-1 min-w-0"><p className="font-medium text-white truncate">{a.name}</p><p className="text-xs text-gray-400 capitalize">{a.role}</p></div>
                <Badge status={a.status} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Success rate</span><span>{a.successRate}%</span></div>
              <Bar rate={a.successRate} />
              <p className="text-xs text-gray-400 mt-2 mb-3">Bounties completed: {a.bountiesCompleted}</p>
              {hiredMap[a.id] && <p className="text-xs text-yellow-400 mb-2" data-testid={`hired-label-${a.id}`}>Hired for: {hiredMap[a.id]}</p>}
              <div className="flex gap-2">
                <Link to={`/agents/${a.id}`} className="flex-1 px-3 py-1.5 text-xs bg-gray-700 text-white rounded text-center" data-testid={`profile-btn-${a.id}`}>Profile</Link>
                <button onClick={() => setSelected(a)} className="flex-1 px-3 py-1.5 text-xs bg-gray-700 text-white rounded" data-testid={`detail-btn-${a.id}`}>Details</button>
                {a.status === 'available' && !hiredMap[a.id] && <button onClick={() => setHiring(a)} className="flex-1 px-3 py-1.5 text-xs bg-brand-500 text-white rounded" data-testid={`hire-btn-${a.id}`}>Hire</button>}
                <button onClick={() => toggleCompare(a.id)} className={`px-3 py-1.5 text-xs rounded ${compareIds.includes(a.id) ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`} aria-pressed={compareIds.includes(a.id)} data-testid={`compare-btn-${a.id}`}>{compareIds.includes(a.id) ? 'Remove' : 'Compare'}</button>
              </div>
            </div>))}
        </div>
        {agents.length === 0 && <p className="text-gray-400 text-center py-8" data-testid="empty-state">No agents match your filters.</p>}
        {selected && (
          <div className={OV} data-testid="detail-modal" role="dialog" aria-label={`${selected.name} details`}>
            <div className={`${MP} max-w-lg`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-brand-500/20 flex items-center justify-center font-bold">{selected.avatar}</div>
                <div className="flex-1"><h2 className="text-xl font-bold text-white">{selected.name}</h2><p className="text-sm text-gray-400 capitalize">{selected.role} - {selected.pricing}</p></div>
                <Badge status={hiredMap[selected.id] ? 'working' : selected.status} />
              </div>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">Performance</h3>
              <Bar rate={selected.successRate} />
              <p className="text-xs text-gray-400 mt-1 mb-4">{selected.successRate}% success across {selected.bountiesCompleted} bounties</p>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">Capabilities</h3>
              <ul className="text-sm text-gray-400 mb-4 list-disc list-inside">{selected.capabilities.map(c => <li key={c}>{c}</li>)}</ul>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">Past Work</h3>
              <ul className="text-sm text-gray-400 mb-4 list-disc list-inside">{selected.pastWork.map(w => <li key={w}>{w}</li>)}</ul>
              <button onClick={() => setSelected(null)} className="w-full py-2 bg-gray-700 text-white rounded" data-testid="close-modal">Close</button>
            </div>
          </div>)}
        {hiring && (
          <div className={OV} data-testid="hire-modal" role="dialog" aria-label={`Hire ${hiring.name}`}>
            <div className={`${MP} max-w-md`}>
              <h2 className="text-lg font-bold text-white mb-3">Hire {hiring.name}</h2>
              <select value={selBounty} onChange={e => setSelBounty(e.target.value)} aria-label="Select bounty" data-testid="bounty-select" className="w-full bg-gray-700 text-white rounded px-3 py-2 mb-3">
                <option value="">Choose bounty...</option>
                {BOUNTIES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => { setHiring(null); setSelBounty(''); }} className="flex-1 py-2 bg-gray-700 text-white rounded" data-testid="cancel-hire">Cancel</button>
                <button onClick={confirmHire} disabled={!selBounty} className="flex-1 py-2 bg-brand-500 text-white rounded disabled:opacity-50" data-testid="confirm-hire">Confirm</button>
              </div>
            </div>
          </div>)}
      </div>
    </div>
  );
}

export default AgentMarketplacePage;
