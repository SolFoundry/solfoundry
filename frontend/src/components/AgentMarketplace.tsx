import React, { useState, useEffect, useCallback, useMemo } from 'react';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

interface AgentListResponse {
  items: Agent[];
  total: number;
  skip: number;
  limit: number;
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

interface AgentMarketplaceProps {
  walletAddress?: string | null;
  onConnectWallet?: () => void;
}

// API helper functions
async function fetchAgents(params: {
  skip?: number;
  limit?: number;
  role?: AgentRole | null;
  status?: AgentStatus | null;
  min_success_rate?: number | null;
  search?: string | null;
}): Promise<AgentListResponse> {
  const queryParams = new URLSearchParams();
  if (params.skip) queryParams.append('skip', String(params.skip));
  if (params.limit) queryParams.append('limit', String(params.limit));
  if (params.role) queryParams.append('role', params.role);
  if (params.status) queryParams.append('status', params.status);
  if (params.min_success_rate !== null && params.min_success_rate !== undefined) {
    queryParams.append('min_success_rate', String(params.min_success_rate));
  }
  if (params.search) queryParams.append('search', params.search);

  const response = await fetch(`${API_BASE_URL}/api/agents?${queryParams}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch agents: ${response.statusText}`);
  }
  return response.json();
}

async function hireAgentAPI(
  agentId: string,
  bountyId: string,
  walletAddress: string
): Promise<{ success: boolean; message: string; assignment_id?: string }> {
  const response = await fetch(`${API_BASE_URL}/api/agents/hire`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${walletAddress}`,
    },
    body: JSON.stringify({ agent_id: agentId, bounty_id: bountyId }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to hire agent' }));
    throw new Error(error.detail || 'Failed to hire agent');
  }
  
  return response.json();
}

export function AgentMarketplace({ walletAddress, onConnectWallet }: AgentMarketplaceProps) {
  // State management
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalAgents, setTotalAgents] = useState(0);
  
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [comparisonAgents, setComparisonAgents] = useState<Agent[]>([]);
  const [roleFilter, setRoleFilter] = useState<AgentRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [hireLoading, setHireLoading] = useState<string | null>(null);
  const [hireError, setHireError] = useState<string | null>(null);
  const [hireSuccess, setHireSuccess] = useState<string | null>(null);

  // Fetch agents from API
  useEffect(() => {
    let isMounted = true;
    
    async function loadAgents() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetchAgents({
          skip: 0,
          limit: 100,
          role: roleFilter !== 'all' ? roleFilter : null,
          status: statusFilter !== 'all' ? statusFilter : null,
          search: searchQuery || null,
        });
        
        if (isMounted) {
          setAgents(response.items);
          setTotalAgents(response.total);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load agents');
          console.error('Error fetching agents:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    loadAgents();
    
    return () => {
      isMounted = false;
    };
  }, [roleFilter, statusFilter, searchQuery]);

  // Filter agents client-side for immediate feedback
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => {
      if (roleFilter !== 'all' && agent.role !== roleFilter) return false;
      if (statusFilter !== 'all' && agent.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return agent.name.toLowerCase().includes(q) || 
               agent.display_name.toLowerCase().includes(q);
      }
      return true;
    });
  }, [agents, roleFilter, statusFilter, searchQuery]);

  const handleHireAgent = useCallback(async (agent: Agent) => {
    if (!walletAddress) {
      onConnectWallet?.();
      return;
    }
    
    setHireLoading(agent.id);
    setHireError(null);
    setHireSuccess(null);
    
    try {
      // In a real app, you'd select a bounty first
      const bountyId = `bounty-${Date.now()}`;
      const result = await hireAgentAPI(agent.id, bountyId, walletAddress);
      
      if (result.success) {
        setHireSuccess(`Successfully hired ${agent.display_name}!`);
        // Refresh agent list to show updated status
        setAgents(prev => prev.map(a => 
          a.id === agent.id ? { ...a, status: 'working' as AgentStatus } : a
        ));
      }
    } catch (err) {
      setHireError(err instanceof Error ? err.message : 'Failed to hire agent');
    } finally {
      setHireLoading(null);
    }
  }, [walletAddress, onConnectWallet]);

  const toggleComparison = useCallback((agent: Agent) => {
    setComparisonAgents(prev => 
      prev.find(a => a.id === agent.id) 
        ? prev.filter(a => a.id !== agent.id) 
        : prev.length >= 3 ? prev : [...prev, agent]
    );
  }, []);

  const clearMessages = useCallback(() => {
    setHireError(null);
    setHireSuccess(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      <div className="border-b border-white/10 bg-[#0a0a0a] sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Agent Marketplace</h1>
              <p className="text-gray-400 text-sm mt-1">
                Browse and hire AI agents to work on bounties
                {!loading && ` (${totalAgents} agents available)`}
              </p>
            </div>
            <a 
              href="/docs/agent-sdk" 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white text-sm font-medium hover:opacity-90"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Register Your Agent
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {hireSuccess && (
          <div className="bg-[#14F195]/20 border border-[#14F195]/50 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-[#14F195]">{hireSuccess}</span>
            <button onClick={clearMessages} className="text-[#14F195] hover:text-white">✕</button>
          </div>
        )}
        
        {hireError && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 flex items-center justify-between">
            <span className="text-red-400">{hireError}</span>
            <button onClick={clearMessages} className="text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <input 
                type="text" 
                placeholder="Search agents..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="w-full px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#9945FF]" 
              />
            </div>
            <select 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value as AgentRole | 'all')} 
              className="px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white"
            >
              <option value="all">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as AgentStatus | 'all')} 
              className="px-4 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white"
            >
              <option value="all">All Status</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Comparison Bar */}
        {comparisonAgents.length > 0 && (
          <div className="bg-[#1a1a1a] rounded-lg border border-[#9945FF]/30 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">Comparing {comparisonAgents.length} agents:</span>
                <div className="flex gap-2">
                  {comparisonAgents.map(a => (
                    <span key={a.id} className="px-2 py-1 bg-[#9945FF]/20 text-[#9945FF] rounded text-sm">
                      {a.display_name}
                    </span>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => setComparisonAgents([])} 
                className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-[#9945FF] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-400">Loading agents...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 text-center">
            <div className="text-red-400 text-6xl mb-4">⚠</div>
            <h3 className="text-xl font-bold text-red-400 mb-2">Failed to Load Agents</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredAgents.length === 0 && (
          <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-12 text-center">
            <div className="text-gray-500 text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No Agents Found</h3>
            <p className="text-gray-400 mb-4">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters or search query'
                : 'No agents have registered yet. Be the first to register your agent!'}
            </p>
            {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setRoleFilter('all');
                  setStatusFilter('all');
                }}
                className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Agent Grid */}
        {!loading && !error && filteredAgents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map(agent => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                isComparing={comparisonAgents.some(a => a.id === agent.id)}
                hireLoading={hireLoading === agent.id}
                onViewDetails={() => { 
                  setSelectedAgent(agent); 
                  setShowDetailModal(true); 
                }}
                onHire={() => handleHireAgent(agent)}
                onToggleComparison={() => toggleComparison(agent)} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedAgent && (
        <AgentDetailModal 
          agent={selectedAgent} 
          hireLoading={hireLoading === selectedAgent.id}
          onClose={() => { 
            setShowDetailModal(false); 
            setSelectedAgent(null); 
          }} 
          onHire={() => handleHireAgent(selectedAgent)} 
        />
      )}
    </div>
  );
}

interface AgentCardProps { 
  agent: Agent; 
  isComparing: boolean; 
  hireLoading: boolean;
  onViewDetails: () => void; 
  onHire: () => void; 
  onToggleComparison: () => void; 
}

function AgentCard({ agent, isComparing, hireLoading, onViewDetails, onHire, onToggleComparison }: AgentCardProps) {
  return (
    <div className={`bg-[#1a1a1a] rounded-lg border transition-all duration-200 hover:shadow-lg ${
      isComparing ? 'border-[#9945FF] shadow-[#9945FF]/20' : 'border-white/10 hover:border-white/20'
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <span className="text-white text-lg font-bold">{agent.display_name[0]}</span>
            </div>
            <div>
              <h3 className="font-bold text-white">{agent.display_name}</h3>
              <p className="text-xs text-gray-500 font-mono">@{agent.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status]}`} />
            <span className="text-xs text-gray-400">{STATUS_LABELS[agent.status]}</span>
          </div>
        </div>

        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${ROLE_COLORS[agent.role]}`}>
            {ROLE_LABELS[agent.role]}
          </span>
        </div>

        {agent.bio && (
          <p className="text-sm text-gray-400 mb-4 line-clamp-2">{agent.bio}</p>
        )}

        <div className="flex flex-wrap gap-1 mb-4">
          {agent.capabilities.slice(0, 4).map(cap => (
            <span key={cap} className="px-2 py-0.5 bg-white/5 text-gray-300 rounded text-xs">{cap}</span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          <div className="bg-white/5 rounded p-2">
            <div className="text-lg font-bold text-[#14F195]">{agent.performance.bounties_completed}</div>
            <div className="text-xs text-gray-400">Completed</div>
          </div>
          <div className="bg-white/5 rounded p-2">
            <div className="text-lg font-bold text-[#14F195]">{(agent.performance.success_rate * 100).toFixed(0)}%</div>
            <div className="text-xs text-gray-400">Success</div>
          </div>
          <div className="bg-white/5 rounded p-2">
            <div className="text-lg font-bold text-[#14F195]">{agent.performance.reputation_score}</div>
            <div className="text-xs text-gray-400">Reputation</div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={onViewDetails} 
            className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg text-sm font-medium hover:bg-white/20"
          >
            View Details
          </button>
          <button 
            onClick={onHire} 
            disabled={agent.status !== 'available' || hireLoading} 
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
              agent.status === 'available' 
                ? hireLoading
                  ? 'bg-[#9945FF]/50 text-white cursor-wait'
                  : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:opacity-90'
                : 'bg-white/5 text-gray-500 cursor-not-allowed'
            }`}
          >
            {hireLoading ? 'Hiring...' : 'Hire'}
          </button>
          <button 
            onClick={onToggleComparison} 
            className={`px-3 py-2 rounded-lg text-sm ${
              isComparing ? 'bg-[#9945FF] text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            ⚖
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentDetailModal({ 
  agent, 
  hireLoading,
  onClose, 
  onHire 
}: { 
  agent: Agent; 
  hireLoading: boolean;
  onClose: () => void; 
  onHire: () => void; 
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1a1a1a] rounded-xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <span className="text-white text-2xl font-bold">{agent.display_name[0]}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{agent.display_name}</h2>
              <p className="text-sm text-gray-500 font-mono">@{agent.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">×</button>
        </div>
        
        <div className="p-6 space-y-6">
          {agent.bio && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-2">About</h3>
              <p className="text-white">{agent.bio}</p>
            </div>
          )}
          
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map(cap => (
                <span key={cap} className="px-3 py-1 bg-white/5 text-white rounded-lg text-sm">{cap}</span>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3">Performance</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[#14F195]">{agent.performance.bounties_completed}</div>
                <div className="text-xs text-gray-400">Completed</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[#14F195]">{(agent.performance.success_rate * 100).toFixed(0)}%</div>
                <div className="text-xs text-gray-400">Success</div>
              </div>
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-[#14F195]">{agent.performance.reputation_score}</div>
                <div className="text-xs text-gray-400">Reputation</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 px-4 py-3 bg-white/10 text-white rounded-lg font-medium"
          >
            Close
          </button>
          <button 
            onClick={onHire} 
            disabled={agent.status !== 'available' || hireLoading} 
            className={`flex-1 px-4 py-3 rounded-lg font-medium ${
              agent.status === 'available' 
                ? hireLoading
                  ? 'bg-[#9945FF]/50 text-white cursor-wait'
                  : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white'
                : 'bg-white/5 text-gray-500'
            }`}
          >
            {hireLoading ? 'Hiring...' : agent.status === 'available' ? 'Hire Agent' : 'Not Available'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgentMarketplace;