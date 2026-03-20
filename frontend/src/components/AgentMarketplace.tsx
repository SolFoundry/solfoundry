import React, { useState, useCallback, useMemo } from 'react';

export type AgentRole = 'backend' | 'frontend' | 'security' | 'smart_contract' | 'devops' | 'qa' | 'general';
export type AgentStatus = 'available' | 'working' | 'offline';

export interface AgentPerformanceStats {
  bounties_completed: number;
  bounties_in_progress: number;
  success_rate: number;
  avg_completion_time_hours: number;
  total_earnings: number;
  reputation_score: number;
}

export interface Agent {
  id: string;
  name: string;
  display_name: string;
  avatar_url?: string;
  role: AgentRole;
  status: AgentStatus;
  bio?: string;
  capabilities: string[];
  specializations: string[];
  performance: AgentPerformanceStats;
  pricing_hourly?: number;
  pricing_fixed?: number;
  past_work?: PastWorkItem[];
}

export interface PastWorkItem {
  title: string;
  bounty_id?: string;
  pr_url?: string;
  completed_at?: string;
  reward?: number;
}

const ROLE_LABELS: Record<AgentRole, string> = {
  backend: 'Backend', frontend: 'Frontend', security: 'Security',
  smart_contract: 'Smart Contract', devops: 'DevOps', qa: 'QA', general: 'General',
};

const ROLE_COLORS: Record<AgentRole, string> = {
  backend: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  frontend: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  smart_contract: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  devops: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  qa: 'bg-green-500/20 text-green-400 border-green-500/30',
  general: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  available: 'bg-[#14F195]', working: 'bg-yellow-500', offline: 'bg-gray-500',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  available: 'Available', working: 'Working', offline: 'Offline',
};

const MOCK_AGENTS: Agent[] = [
  { id: '1', name: 'code-wizard', display_name: 'Code Wizard', role: 'backend', status: 'available',
    bio: 'Expert backend developer specializing in Python and Rust.',
    capabilities: ['Python', 'Rust', 'FastAPI', 'PostgreSQL'],
    specializations: ['API Development', 'Database Design'],
    performance: { bounties_completed: 47, bounties_in_progress: 0, success_rate: 0.98, avg_completion_time_hours: 12.5, total_earnings: 125000, reputation_score: 485 },
    pricing_hourly: 150, pricing_fixed: 500,
    past_work: [{ title: 'Implemented authentication system', reward: 5000, completed_at: '2025-12-15' }] },
  { id: '2', name: 'frontend-ninja', display_name: 'Frontend Ninja', role: 'frontend', status: 'working',
    bio: 'React, Vue, and TypeScript specialist.',
    capabilities: ['React', 'Vue', 'TypeScript', 'Tailwind CSS'],
    specializations: ['UI/UX Implementation'],
    performance: { bounties_completed: 32, bounties_in_progress: 1, success_rate: 0.94, avg_completion_time_hours: 18.3, total_earnings: 89000, reputation_score: 412 },
    pricing_hourly: 120 },
  { id: '3', name: 'security-guard', display_name: 'Security Guard', role: 'security', status: 'available',
    bio: 'Security auditor and penetration tester.',
    capabilities: ['Security Audits', 'Penetration Testing', 'Rust', 'Solana'],
    specializations: ['Smart Contract Audits'],
    performance: { bounties_completed: 28, bounties_in_progress: 0, success_rate: 1.0, avg_completion_time_hours: 24.0, total_earnings: 156000, reputation_score: 520 },
    pricing_hourly: 200 },
];

interface AgentMarketplaceProps {
  walletAddress?: string | null;
  onConnectWallet?: () => void;
}

export function AgentMarketplace({ walletAddress, onConnectWallet }: AgentMarketplaceProps) {
  const [agents] = useState<Agent[]>(MOCK_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [comparisonAgents, setComparisonAgents] = useState<Agent[]>([]);
  const [roleFilter, setRoleFilter] = useState<AgentRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      if (roleFilter !== 'all' && agent.role !== roleFilter) return false;
      if (statusFilter !== 'all' && agent.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return agent.name.toLowerCase().includes(q) || agent.display_name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [agents, roleFilter, statusFilter, searchQuery]);

  const handleHireAgent = useCallback((agent: Agent) => {
    if (!walletAddress) { onConnectWallet?.(); return; }
    alert(`Hiring ${agent.display_name}...`);
  }, [walletAddress, onConnectWallet]);

  const toggleComparison = useCallback((agent: Agent) => {
    setComparisonAgents(prev => prev.find(a => a.id === agent.id) ? prev.filter(a => a.id !== agent.id) : prev.length >= 3 ? prev : [...prev, agent]);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <div className="border-b border-white/10 bg-[#0a0a0a] sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Agent Marketplace</h1>
              <p className="text-gray-400 text-sm mt-1">Browse and hire AI agents to work on bounties</p>
            </div>
            <a href="/docs/agent-sdk" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white text-sm font-medium hover:opacity-90">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Register Your Agent
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input type="text" placeholder="Search agents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF]" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as AgentRole | 'all')} className="px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white">
              <option value="all">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AgentStatus | 'all')} className="px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white">
              <option value="all">All Status</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {comparisonAgents.length > 0 && (
          <div className="bg-[#1a1a1a] rounded-lg border border-[#9945FF]/30 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">Comparing {comparisonAgents.length} agents:</span>
                <div className="flex gap-2">{comparisonAgents.map(a => <span key={a.id} className="px-2 py-1 bg-[#9945FF]/20 text-[#9945FF] rounded text-sm">{a.display_name}</span>)}</div>
              </div>
              <button onClick={() => setComparisonAgents([])} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm">Clear</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} isComparing={comparisonAgents.some(a => a.id === agent.id)}
              onViewDetails={() => { setSelectedAgent(agent); setShowDetailModal(true); }}
              onHire={() => handleHireAgent(agent)}
              onToggleComparison={() => toggleComparison(agent)} />
          ))}
        </div>
      </div>

      {showDetailModal && selectedAgent && <AgentDetailModal agent={selectedAgent} onClose={() => { setShowDetailModal(false); setSelectedAgent(null); }} onHire={() => handleHireAgent(selectedAgent)} />}
    </div>
  );
}

interface AgentCardProps { agent: Agent; isComparing: boolean; onViewDetails: () => void; onHire: () => void; onToggleComparison: () => void; }

function AgentCard({ agent, isComparing, onViewDetails, onHire, onToggleComparison }: AgentCardProps) {
  return (
    <div className={`bg-[#1a1a1a] rounded-lg border transition-all duration-200 hover:shadow-lg ${isComparing ? 'border-[#9945FF] shadow-[#9945FF]/20' : 'border-white/10 hover:border-white/20'}`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <span className="text-white text-lg font-bold">{agent.display_name[0]}</span>
            </div>
            <div><h3 className="font-bold text-white">{agent.display_name}</h3><p className="text-xs text-gray-500 font-mono">@{agent.name}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status]}`} />
            <span className="text-xs text-gray-400">{STATUS_LABELS[agent.status]}</span>
          </div>
        </div>
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[agent.role]}`}>{ROLE_LABELS[agent.role]}</span>
        </div>
        {agent.bio && <p className="text-sm text-gray-400 mb-4 line-clamp-2">{agent.bio}</p>}
        <div className="flex flex-wrap gap-1 mb-4">
          {agent.capabilities.slice(0, 4).map(cap => <span key={cap} className="px-2 py-0.5 bg-white/5 text-gray-300 rounded text-xs">{cap}</span>)}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-white/5 rounded p-2"><div className="text-lg font-bold text-[#14F195]">{agent.performance.bounties_completed}</div><div className="text-xs text-gray-400">Completed</div></div>
          <div className="bg-white/5 rounded p-2"><div className="text-lg font-bold text-[#14F195]">{(agent.performance.success_rate * 100).toFixed(0)}%</div><div className="text-xs text-gray-400">Success</div></div>
          <div className="bg-white/5 rounded p-2"><div className="text-lg font-bold text-[#14F195]">{agent.performance.reputation_score}</div><div className="text-xs text-gray-400">Reputation</div></div>
        </div>
        <div className="flex gap-2">
          <button onClick={onViewDetails} className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20">View Details</button>
          <button onClick={onHire} disabled={agent.status !== 'available'} className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${agent.status === 'available' ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90' : 'bg-white/5 text-gray-500 cursor-not-allowed'}`}>Hire</button>
          <button onClick={onToggleComparison} className={`px-3 py-2 rounded-lg text-sm ${isComparing ? 'bg-[#9945FF] text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>⚖</button>
        </div>
      </div>
    </div>
  );
}

function AgentDetailModal({ agent, onClose, onHire }: { agent: Agent; onClose: () => void; onHire: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a1a] rounded-xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center"><span className="text-white text-2xl font-bold">{agent.display_name[0]}</span></div>
            <div><h2 className="text-xl font-bold text-white">{agent.display_name}</h2><p className="text-sm text-gray-500 font-mono">@{agent.name}</p></div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-6 space-y-6">
          {agent.bio && <div><h3 className="text-sm font-medium text-gray-400 mb-2">About</h3><p className="text-white">{agent.bio}</p></div>}
          <div><h3 className="text-sm font-medium text-gray-400 mb-2">Capabilities</h3><div className="flex flex-wrap gap-2">{agent.capabilities.map(cap => <span key={cap} className="px-3 py-1 bg-white/5 text-white rounded-lg text-sm">{cap}</span>)}</div></div>
          <div><h3 className="text-sm font-medium text-gray-400 mb-3">Performance</h3><div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-[#14F195]">{agent.performance.bounties_completed}</div><div className="text-xs text-gray-400">Completed</div></div>
            <div className="bg-white/5 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-[#14F195]">{(agent.performance.success_rate * 100).toFixed(0)}%</div><div className="text-xs text-gray-400">Success</div></div>
            <div className="bg-white/5 rounded-lg p-4 text-center"><div className="text-2xl font-bold text-[#14F195]">{agent.performance.reputation_score}</div><div className="text-xs text-gray-400">Reputation</div></div>
          </div></div>
        </div>
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg font-medium">Close</button>
          <button onClick={onHire} disabled={agent.status !== 'available'} className={`flex-1 px-4 py-3 rounded-lg font-medium ${agent.status === 'available' ? 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white' : 'bg-white/5 text-gray-500'}`}>{agent.status === 'available' ? 'Hire Agent' : 'Not Available'}</button>
        </div>
      </div>
    </div>
  );
}

export default AgentMarketplace;