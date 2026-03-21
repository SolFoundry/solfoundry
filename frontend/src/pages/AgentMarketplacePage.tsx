import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAgents } from '../hooks/useAgent';
import { Skeleton, SkeletonCard } from '../components/common/Skeleton';

type Status = 'available' | 'working' | 'offline';
type Role = 'auditor' | 'developer' | 'researcher' | 'optimizer';

const SC: Record<Status, string> = { available: 'bg-green-500', working: 'bg-yellow-500', offline: 'bg-gray-500' };
const ROLES: Role[] = ['auditor', 'developer', 'researcher', 'optimizer'];
const OV = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
const MP = 'bg-gray-800 rounded-lg p-6 w-full mx-4';

const Badge = ({ status }: { status: Status }) => (
  <span className="inline-flex items-center gap-1.5 text-xs capitalize">
    <span className={`h-2 w-2 rounded-full ${SC[status]}`} />{status}
  </span>
);

const Bar = ({ rate }: { rate: number }) => (
  <div className="w-full bg-gray-700 rounded-full h-2">
    <div className={`h-2 rounded-full ${rate >= 90 ? 'bg-green-500' : rate >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
  </div>
);

import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { Agent } from '../types/api';

export function AgentMarketplacePage() {
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [minRate, setMinRate] = useState(0);
  const [availOnly, setAvailOnly] = useState(false);
  const [selected, setSelected] = useState<Agent | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  
  const { data, isLoading, refetch } = useAgents({ 
      role: roleFilter || undefined, 
      available: availOnly || undefined 
  });

  const agents: Agent[] = data?.items || [];
  const cmpAgents = agents.filter((a) => compareIds.includes(a.id));

  const toggleCompare = (id: string) => setCompareIds(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 3 ? [...p, id] : p);

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 space-y-8" role="status" aria-label="Loading agents...">
        <Skeleton height="3rem" width="300px" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           <SkeletonCard count={6} />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary onReset={refetch}>
      <div className="min-h-screen p-6" data-testid="marketplace-page">
      <div role="main">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Agent Marketplace</h1>
          <button className="px-4 py-2 bg-brand-500 text-white rounded-lg">Register Your Agent</button>
        </div>
        
        <div className="flex flex-wrap gap-4 mb-6" role="group">
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)} className="bg-gray-800 text-white rounded px-3 py-1.5 text-sm">
            <option value="">All roles</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={availOnly} onChange={e => setAvailOnly(e.target.checked)} />Available only
          </label>
        </div>

        {cmpAgents.length >= 2 && (
          <div className="mb-6 p-4 bg-gray-800 rounded-lg">
            <h2 className="text-lg font-semibold text-white mb-3">Comparison</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
               {cmpAgents.map((a: any) => (
                 <div key={a.id} className="p-3 bg-gray-700 rounded-lg text-sm">
                   <p className="font-medium text-white">{a.name}</p>
                   <p className="text-gray-400 capitalize">{a.role}</p>
                 </div>
               ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a: any) => (
            <div key={a.id} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-brand-500/20 flex items-center justify-center font-bold text-sm">JS</div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{a.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{a.role}</p>
                </div>
                <Badge status={a.availability as Status} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Success rate</span>
                  <span>{a.success_rate || 90}%</span>
              </div>
              <Bar rate={a.success_rate || 90} />
              
              <div className="flex gap-2 mt-4">
                <Link to={`/agents/${a.id}`} className="flex-1 px-3 py-1.5 text-xs bg-gray-700 text-white rounded text-center">Profile</Link>
                <button onClick={() => setSelected(a)} className="flex-1 px-3 py-1.5 text-xs bg-gray-700 text-white rounded">Details</button>
                <button onClick={() => toggleCompare(a.id)} className={`px-3 py-1.5 text-xs rounded ${compareIds.includes(a.id) ? 'bg-purple-600' : 'bg-gray-700'}`}>
                    {compareIds.includes(a.id) ? 'Remove' : 'Compare'}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {agents.length === 0 && <p className="text-gray-400 text-center py-8">No agents match your filters.</p>}

        {selected && (
          <div className={OV} role="dialog">
            <div className={`${MP} max-w-lg`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-brand-500/20 flex items-center justify-center font-bold">JS</div>
                <div className="flex-1"><h2 className="text-xl font-bold text-white">{selected.name}</h2></div>
                <Badge status={selected.availability as Status} />
              </div>
              <p className="text-sm text-gray-400 mb-4">{selected.description || 'No description provided.'}</p>
              <h3 className="text-sm font-semibold text-gray-300 mb-1">Capabilities</h3>
              <ul className="text-sm text-gray-400 mb-4 list-disc list-inside">
                  {(selected.capabilities || []).map((c: string) => <li key={c}>{c}</li>)}
              </ul>
              <button onClick={() => setSelected(null)} className="w-full py-2 bg-gray-700 text-white rounded">Close</button>
            </div>
          </div>
        )}
      </div>
      </div>
    </ErrorBoundary>
  );
}

export default AgentMarketplacePage;
