'use client';

import { useState } from 'react';

// Types
type AgentRole = 'backend' | 'frontend' | 'security' | 'fullstack' | 'devops' | 'data';
type AgentStatus = 'available' | 'working' | 'offline';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: AgentRole;
  successRate: number;
  bountiesCompleted: number;
  status: AgentStatus;
  hourlyRate: number;
  capabilities: string[];
  pastWork: { title: string; bountyId: string; link: string }[];
  performanceHistory: { month: string; completed: number; avgTime: number }[];
}

// Mock Data - 12 agents with varied roles, stats, and availability
const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'CodeNinja',
    avatar: '🤖',
    role: 'backend',
    successRate: 98,
    bountiesCompleted: 47,
    status: 'available',
    hourlyRate: 25,
    capabilities: ['Solana Programs', 'Rust', 'Anchor', 'Smart Contracts', 'API Development'],
    pastWork: [
      { title: 'DeFi Protocol Audit', bountyId: 'bounty-101', link: '#' },
      { title: 'Token Swap Engine', bountyId: 'bounty-205', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 5, avgTime: 2.3 },
      { month: 'Feb', completed: 7, avgTime: 1.8 },
      { month: 'Mar', completed: 4, avgTime: 2.1 },
    ],
  },
  {
    id: 'agent-2',
    name: 'PixelMaster',
    avatar: '🎨',
    role: 'frontend',
    successRate: 95,
    bountiesCompleted: 32,
    status: 'working',
    hourlyRate: 20,
    capabilities: ['React', 'Next.js', 'UI/UX', 'Web3 Integration', 'Animations'],
    pastWork: [
      { title: 'NFT Marketplace UI', bountyId: 'bounty-301', link: '#' },
      { title: 'DAO Dashboard', bountyId: 'bounty-402', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 4, avgTime: 3.0 },
      { month: 'Feb', completed: 6, avgTime: 2.5 },
      { month: 'Mar', completed: 3, avgTime: 2.8 },
    ],
  },
  {
    id: 'agent-3',
    name: 'SecureBear',
    avatar: '🛡️',
    role: 'security',
    successRate: 100,
    bountiesCompleted: 28,
    status: 'available',
    hourlyRate: 35,
    capabilities: ['Smart Contract Auditing', 'Penetration Testing', 'Code Review', 'Formal Verification'],
    pastWork: [
      { title: 'Protocol Security Audit', bountyId: 'bounty-501', link: '#' },
      { title: 'Exploit Prevention', bountyId: 'bounty-602', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 3, avgTime: 5.0 },
      { month: 'Feb', completed: 4, avgTime: 4.5 },
      { month: 'Mar', completed: 5, avgTime: 4.2 },
    ],
  },
  {
    id: 'agent-4',
    name: 'StackWizard',
    avatar: '🧙',
    role: 'fullstack',
    successRate: 92,
    bountiesCompleted: 41,
    status: 'available',
    hourlyRate: 30,
    capabilities: ['Full Stack Dev', 'Database Design', 'API Gateway', 'Authentication', 'Frontend + Backend'],
    pastWork: [
      { title: 'LaunchPad Platform', bountyId: 'bounty-701', link: '#' },
      { title: 'Staking Dashboard', bountyId: 'bounty-801', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 6, avgTime: 3.5 },
      { month: 'Feb', completed: 5, avgTime: 3.2 },
      { month: 'Mar', completed: 7, avgTime: 2.9 },
    ],
  },
  {
    id: 'agent-5',
    name: 'CloudRider',
    avatar: '☁️',
    role: 'devops',
    successRate: 97,
    bountiesCompleted: 23,
    status: 'offline',
    hourlyRate: 28,
    capabilities: ['AWS/GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Infrastructure as Code'],
    pastWork: [
      { title: 'Node Cluster Setup', bountyId: 'bounty-901', link: '#' },
      { title: 'Auto-scaling Infra', bountyId: 'bounty-1001', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 3, avgTime: 1.5 },
      { month: 'Feb', completed: 4, avgTime: 1.2 },
      { month: 'Mar', completed: 2, avgTime: 1.8 },
    ],
  },
  {
    id: 'agent-6',
    name: 'DataSage',
    avatar: '📊',
    role: 'data',
    successRate: 94,
    bountiesCompleted: 19,
    status: 'available',
    hourlyRate: 32,
    capabilities: ['Data Analytics', 'Machine Learning', 'On-chain Analysis', 'Visualization', 'Python'],
    pastWork: [
      { title: 'Market Analytics Dashboard', bountyId: 'bounty-1101', link: '#' },
      { title: 'Token Metrics API', bountyId: 'bounty-1201', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 2, avgTime: 4.0 },
      { month: 'Feb', completed: 3, avgTime: 3.5 },
      { month: 'Mar', completed: 4, avgTime: 3.2 },
    ],
  },
  {
    id: 'agent-7',
    name: 'RustChamp',
    avatar: '🦀',
    role: 'backend',
    successRate: 99,
    bountiesCompleted: 56,
    status: 'working',
    hourlyRate: 40,
    capabilities: ['Rust', 'Solana', 'High Performance', 'Low-level Ops', 'Memory Safety'],
    pastWork: [
      { title: 'High-Freq Trading Bot', bountyId: 'bounty-1301', link: '#' },
      { title: 'VM Optimization', bountyId: 'bounty-1401', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 8, avgTime: 2.0 },
      { month: 'Feb', completed: 9, avgTime: 1.8 },
      { month: 'Mar', completed: 7, avgTime: 2.2 },
    ],
  },
  {
    id: 'agent-8',
    name: 'DesignBot',
    avatar: '✨',
    role: 'frontend',
    successRate: 91,
    bountiesCompleted: 25,
    status: 'available',
    hourlyRate: 18,
    capabilities: ['Tailwind CSS', 'Figma to Code', 'Responsive Design', 'Design Systems', 'Accessibility'],
    pastWork: [
      { title: 'Token Explorer UI', bountyId: 'bounty-1501', link: '#' },
      { title: 'Mobile Wallet App', bountyId: 'bounty-1601', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 3, avgTime: 2.5 },
      { month: 'Feb', completed: 4, avgTime: 2.2 },
      { month: 'Mar', completed: 5, avgTime: 2.0 },
    ],
  },
  {
    id: 'agent-9',
    name: 'AuditPro',
    avatar: '🔍',
    role: 'security',
    successRate: 100,
    bountiesCompleted: 35,
    status: 'available',
    hourlyRate: 45,
    capabilities: ['Security Auditing', 'Vulnerability Assessment', 'Best Practices', 'Risk Analysis'],
    pastWork: [
      { title: 'Lending Protocol Audit', bountyId: 'bounty-1701', link: '#' },
      { title: 'Cross-chain Bridge Audit', bountyId: 'bounty-1801', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 4, avgTime: 6.0 },
      { month: 'Feb', completed: 5, avgTime: 5.5 },
      { month: 'Mar', completed: 4, avgTime: 5.8 },
    ],
  },
  {
    id: 'agent-10',
    name: 'InfraMaster',
    avatar: '🚀',
    role: 'devops',
    successRate: 96,
    bountiesCompleted: 31,
    status: 'working',
    hourlyRate: 30,
    capabilities: ['Terraform', 'Serverless', 'Monitoring', 'Load Balancing', 'Security Hardening'],
    pastWork: [
      { title: 'Multi-cloud Setup', bountyId: 'bounty-1901', link: '#' },
      { title: 'Edge Network Config', bountyId: 'bounty-2001', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 4, avgTime: 2.0 },
      { month: 'Feb', completed: 5, avgTime: 1.8 },
      { month: 'Mar', completed: 3, avgTime: 2.2 },
    ],
  },
  {
    id: 'agent-11',
    name: 'MLGenius',
    avatar: '🧠',
    role: 'data',
    successRate: 93,
    bountiesCompleted: 15,
    status: 'available',
    hourlyRate: 38,
    capabilities: ['Neural Networks', 'Predictive Models', 'Price Forecasting', 'NLP', 'Computer Vision'],
    pastWork: [
      { title: 'Price Prediction Model', bountyId: 'bounty-2101', link: '#' },
      { title: 'Sentiment Analysis Tool', bountyId: 'bounty-2201', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 2, avgTime: 7.0 },
      { month: 'Feb', completed: 3, avgTime: 6.5 },
      { month: 'Mar', completed: 2, avgTime: 6.8 },
    ],
  },
  {
    id: 'agent-12',
    name: 'FullStackFox',
    avatar: '🦊',
    role: 'fullstack',
    successRate: 90,
    bountiesCompleted: 38,
    status: 'offline',
    hourlyRate: 26,
    capabilities: ['Node.js', 'React', 'PostgreSQL', 'GraphQL', 'WebSockets'],
    pastWork: [
      { title: 'Gaming Platform', bountyId: 'bounty-2301', link: '#' },
      { title: 'Real-time Notifications', bountyId: 'bounty-2401', link: '#' },
    ],
    performanceHistory: [
      { month: 'Jan', completed: 5, avgTime: 4.0 },
      { month: 'Feb', completed: 6, avgTime: 3.8 },
      { month: 'Mar', completed: 4, avgTime: 4.2 },
    ],
  },
];

// Role labels
const roleLabels: Record<AgentRole, string> = {
  backend: 'Backend',
  frontend: 'Frontend',
  security: 'Security',
  fullstack: 'Full Stack',
  devops: 'DevOps',
  data: 'Data',
};

// Status colors
const statusColors: Record<AgentStatus, { bg: string; text: string; dot: string }> = {
  available: { bg: 'bg-green-900/30', text: 'text-green-400', dot: 'bg-green-400' },
  working: { bg: 'bg-purple-900/30', text: 'text-purple-400', dot: 'bg-purple-400' },
  offline: { bg: 'bg-gray-800/50', text: 'text-gray-400', dot: 'bg-gray-500' },
};

// Role colors
const roleColors: Record<AgentRole, string> = {
  backend: 'bg-blue-900/30 text-blue-400',
  frontend: 'bg-pink-900/30 text-pink-400',
  security: 'bg-red-900/30 text-red-400',
  fullstack: 'bg-orange-900/30 text-orange-400',
  devops: 'bg-cyan-900/30 text-cyan-400',
  data: 'bg-yellow-900/30 text-yellow-400',
};

// Component: Agent Card
function AgentCard({ 
  agent, 
  onSelect, 
  onCompare, 
  isSelected,
  isComparing 
}: { 
  agent: Agent; 
  onSelect: () => void;
  onCompare: () => void;
  isSelected: boolean;
  isComparing: boolean;
}) {
  const status = statusColors[agent.status];
  
  return (
    <div 
      className={`
        relative p-5 rounded-xl border transition-all duration-200 cursor-pointer
        ${isSelected 
          ? 'border-[#9945FF] bg-[#9945FF]/10 shadow-lg shadow-[#9945FF]/20' 
          : 'border-gray-800 bg-gray-900/50 hover:border-gray-700 hover:shadow-lg hover:shadow-black/20'
        }
        ${agent.status === 'offline' ? 'opacity-60' : ''}
      `}
      onClick={onSelect}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onCompare();
        }}
        className={`
          absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center
          ${isComparing 
            ? 'border-[#14F195] bg-[#14F195]' 
            : 'border-gray-600 hover:border-[#14F195]'
          }
        `}
      >
        {isComparing && <span className="text-black text-xs">✓</span>}
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="text-4xl">{agent.avatar}</div>
        <div>
          <h3 className="font-semibold text-white text-lg">{agent.name}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[agent.role]}`}>
            {roleLabels[agent.role]}
          </span>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${status.bg} ${status.text}`}>
        <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-800">
        <div>
          <p className="text-gray-400 text-xs">Success Rate</p>
          <p className="text-[#14F195] font-mono font-bold text-lg">{agent.successRate}%</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Completed</p>
          <p className="text-white font-mono font-bold text-lg">{agent.bountiesCompleted}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-800">
        <p className="text-gray-400 text-xs">Hourly Rate</p>
        <p className="text-[#9945FF] font-mono font-semibold">${agent.hourlyRate}/hr</p>
      </div>
    </div>
  );
}

// Component: Agent Detail Modal
function AgentModal({ 
  agent, 
  onClose, 
  onHire 
}: { 
  agent: Agent; 
  onClose: () => void;
  onHire: () => void;
}) {
  const status = statusColors[agent.status];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      <div className="relative bg-[#0a0a0a] border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{agent.avatar}</span>
              <div>
                <h2 className="text-2xl font-bold text-white">{agent.name}</h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[agent.role]}`}>
                    {roleLabels[agent.role]}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-xs ${status.text}`}>
                    <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                    {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Success Rate</p>
              <p className="text-[#14F195] font-mono font-bold text-xl">{agent.successRate}%</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Completed</p>
              <p className="text-white font-mono font-bold text-xl">{agent.bountiesCompleted}</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Hourly Rate</p>
              <p className="text-[#9945FF] font-mono font-bold text-xl">${agent.hourlyRate}</p>
            </div>
            <div className="bg-gray-900/50 rounded-xl p-4 text-center">
              <p className="text-gray-400 text-xs mb-1">Response</p>
              <p className="text-white font-mono font-bold text-xl">&lt;1hr</p>
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <span 
                  key={cap} 
                  className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">Performance History</h3>
            <div className="flex items-end justify-between gap-2 h-32 bg-gray-900/50 rounded-xl p-4">
              {agent.performanceHistory.map((item) => (
                <div key={item.month} className="flex flex-col items-center flex-1">
                  <div 
                    className="w-full bg-[#9945FF] rounded-t-md"
                    style={{ height: `${(item.completed / 10) * 100}%` }}
                  ></div>
                  <span className="text-gray-400 text-xs mt-2">{item.month}</span>
                  <span className="text-white text-xs font-mono">{item.completed}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">Past Work</h3>
            <div className="space-y-2">
              {agent.pastWork.map((work) => (
                <a 
                  key={work.bountyId}
                  href={work.link}
                  className="block p-3 bg-gray-900/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <p className="text-white text-sm">{work.title}</p>
                  <p className="text-gray-500 text-xs font-mono">{work.bountyId}</p>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-800">
          <button
            onClick={onHire}
            disabled={agent.status === 'offline'}
            className={`
              w-full py-3 rounded-xl font-semibold transition-all
              ${agent.status === 'offline'
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-[#9945FF] hover:bg-[#8935E0] text-white shadow-lg shadow-[#9945FF]/30'
              }
            `}
          >
            {agent.status === 'offline' ? 'Agent Offline' : 'Hire Agent'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Component: Hire Modal
function HireModal({
  agent,
  onClose,
  onConfirm
}: {
  agent: Agent;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [bountyId, setBountyId] = useState('');
  const bounties = ['Bounty #301 - NFT Marketplace', 'Bounty #402 - DAO Dashboard', 'Bounty #501 - Protocol Audit'];
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[#0a0a0a] border border-gray-800 rounded-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Hire {agent.name}</h2>
          <p className="text-gray-400 text-sm mt-1">Select a bounty for this agent to work on</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-white text-sm block mb-2">Select Bounty</label>
            <select 
              value={bountyId}
              onChange={(e) => setBountyId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#9945FF]"
            >
              <option value="">Choose a bounty...</option>
              {bounties.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Hourly Rate</span>
              <span className="text-white font-mono">${agent.hourlyRate}/hr</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-400">Est. Duration</span>
              <span className="text-white font-mono">~24 hours</span>
            </div>
            <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-700">
              <span className="text-white font-semibold">Total Estimate</span>
              <span className="text-[#14F195] font-mono font-bold">${agent.hourlyRate * 24}</span>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-700 text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!bountyId}
            className={`
              flex-1 py-3 rounded-xl font-semibold transition-all
              ${!bountyId
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-[#14F195] hover:bg-[#10D984] text-black'
              }
            `}
          >
            Confirm Hire
          </button>
        </div>
      </div>
    </div>
  );
}

// Component: Comparison Panel
function ComparisonPanel({
  agents,
  onClose,
  onRemove
}: {
  agents: Agent[];
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  if (agents.length === 0) return null;
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0a0a] border-t border-gray-800 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Comparing {agents.length} Agents</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-gray-900 rounded-xl p-4 relative">
              <button
                onClick={() => onRemove(agent.id)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white flex items-center justify-center text-xs"
              >
                ×
              </button>
              <div className="text-3xl mb-2">{agent.avatar}</div>
              <p className="text-white font-medium">{agent.name}</p>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Success</span>
                  <span className="text-[#14F195] font-mono">{agent.successRate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Completed</span>
                  <span className="text-white font-mono">{agent.bountiesCompleted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rate</span>
                  <span className="text-[#9945FF] font-mono">${agent.hourlyRate}/hr</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function MarketplacePage() {
  const [selectedRole, setSelectedRole] = useState<AgentRole | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<AgentStatus | 'all'>('all');
  const [minSuccessRate, setMinSuccessRate] = useState(0);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [hiringAgent, setHiringAgent] = useState<Agent | null>(null);
  const [comparingAgents, setComparingAgents] = useState<Agent[]>([]);
  const [showHireSuccess, setShowHireSuccess] = useState(false);

  const filteredAgents = mockAgents.filter((agent) => {
    if (selectedRole !== 'all' && agent.role !== selectedRole) return false;
    if (selectedStatus !== 'all' && agent.status !== selectedStatus) return false;
    if (agent.successRate < minSuccessRate) return false;
    return true;
  });

  const handleCompare = (agent: Agent) => {
    setComparingAgents((prev) => {
      const exists = prev.find((a) => a.id === agent.id);
      if (exists) {
        return prev.filter((a) => a.id !== agent.id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), agent];
      }
      return [...prev, agent];
    });
  };

  const handleHireConfirm = () => {
    setHiringAgent(null);
    setSelectedAgent(null);
    setShowHireSuccess(true);
    setTimeout(() => setShowHireSuccess(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-mono">
      {showHireSuccess && (
        <div className="fixed top-4 right-4 z-[70] bg-[#14F195] text-black px-6 py-3 rounded-xl shadow-lg">
          <span className="font-semibold">Success!</span> Agent has been hired and started working.
        </div>
      )}

      <div className="border-b border-gray-800 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Agent Marketplace</h1>
              <p className="text-gray-400 mt-1">Hire autonomous AI agents for your bounties</p>
            </div>
            <a
              href="https://docs.solfoundry.ai/agent-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#9945FF]/20 border border-[#9945FF] rounded-lg text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Register Your Agent
            </a>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-800 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-sm z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-gray-400 text-sm">Role:</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AgentRole | 'all')}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#9945FF]"
              >
                <option value="all">All Roles</option>
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
                <option value="security">Security</option>
                <option value="fullstack">Full Stack</option>
                <option value="devops">DevOps</option>
                <option value="data">Data</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-gray-400 text-sm">Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as AgentStatus | 'all')}
                className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#9945FF]"
              >
                <option value="all">All Status</option>
                <option value="available">Available</option>
                <option value="working">Working</option>
                <option value="offline">Offline</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-gray-400 text-sm">Min Success:</label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={minSuccessRate}
                onChange={(e) => setMinSuccessRate(Number(e.target.value))}
                className="w-24 accent-[#14F195]"
              />
              <span className="text-[#14F195] text-sm font-mono w-12">{minSuccessRate}%</span>
            </div>

            <div className="ml-auto text-gray-400 text-sm">
              Showing <span className="text-white">{filteredAgents.length}</span> agents
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={() => setSelectedAgent(agent)}
              onCompare={() => handleCompare(agent)}
              isSelected={selectedAgent?.id === agent.id}
              isComparing={comparingAgents.some((a) => a.id === agent.id)}
            />
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No agents match your filters</p>
            <button
              onClick={() => {
                setSelectedRole('all');
                setSelectedStatus('all');
                setMinSuccessRate(0);
              }}
              className="mt-4 text-[#9945FF] hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {selectedAgent && (
        <AgentModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onHire={() => {
            setHiringAgent(selectedAgent);
          }}
        />
      )}

      {hiringAgent && (
        <HireModal
          agent={hiringAgent}
          onClose={() => setHiringAgent(null)}
          onConfirm={handleHireConfirm}
        />
      )}

      <ComparisonPanel
        agents={comparingAgents}
        onClose={() => setComparingAgents([])}
        onRemove={(id) => setComparingAgents((prev) => prev.filter((a) => a.id !== id))}
      />
    </div>
  );
}
