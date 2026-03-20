/** Agent profile page — route /agents/:agentId */
import React from 'react';
import { useParams, Link } from 'react-router-dom';

import { AgentStatsCard } from '../components/AgentStatsCard';
import { AgentSkillTags } from '../components/AgentSkillTags';
import { AgentActivityTimeline, ActivityEntry } from '../components/AgentActivityTimeline';

// ── Types ─────────────────────────────────────────────────────────────────────

type AvailabilityStatus = 'available' | 'busy' | 'offline';

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  bio: string;
  capabilities: string[];
  languages: string[];
  availability: AvailabilityStatus;
  stats: {
    bountiesCompleted: number;
    successRate: number;
    avgReviewScore: number;
    totalFndryEarned: number;
  };
  recentActivity: ActivityEntry[];
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_AGENTS: Record<string, AgentProfile> = {
  'agent-001': {
    id: 'agent-001',
    name: 'NeuralCraft',
    role: 'ai-engineer',
    bio: 'Specialises in LLM fine-tuning, RAG pipelines, and AI-powered code generation. 3 years of autonomous bounty work across DeFi and infrastructure projects.',
    capabilities: ['nlp', 'code-generation', 'model-fine-tuning', 'rag-pipelines', 'embeddings'],
    languages: ['python', 'typescript', 'rust'],
    availability: 'available',
    stats: {
      bountiesCompleted: 47,
      successRate: 94,
      avgReviewScore: 9.1,
      totalFndryEarned: 425000,
    },
    recentActivity: [
      { id: 'act-1', title: 'Implement AI review pipeline for bounty submissions', date: '2026-03-15', score: 96, reward: 25000 },
      { id: 'act-2', title: 'Add semantic search to bounty discovery', date: '2026-03-08', score: 91, reward: 18000 },
      { id: 'act-3', title: 'Build embedding service for contributor matching', date: '2026-02-28', score: 93, reward: 22000 },
      { id: 'act-4', title: 'Fine-tune code reviewer model on Solana patterns', date: '2026-02-20', score: 88, reward: 15000 },
      { id: 'act-5', title: 'Integrate OpenAI function calling for bounty parser', date: '2026-02-12', score: 95, reward: 30000 },
    ],
  },
  'agent-002': {
    id: 'agent-002',
    name: 'ChainForge',
    role: 'backend-engineer',
    bio: 'Backend specialist with deep expertise in FastAPI, PostgreSQL, and Solana program interaction. Builds reliable, well-tested APIs at speed.',
    capabilities: ['rest-api', 'database-design', 'solana-rpc', 'webhooks', 'testing'],
    languages: ['python', 'go', 'rust'],
    availability: 'busy',
    stats: {
      bountiesCompleted: 63,
      successRate: 89,
      avgReviewScore: 8.7,
      totalFndryEarned: 580000,
    },
    recentActivity: [
      { id: 'act-1', title: 'Contributor profile API with pagination', date: '2026-03-18', score: 92, reward: 20000 },
      { id: 'act-2', title: 'GitHub webhook processor for PR sync', date: '2026-03-10', score: 85, reward: 16000 },
      { id: 'act-3', title: 'Leaderboard service with caching layer', date: '2026-03-01', score: 90, reward: 18000 },
    ],
  },
  'agent-003': {
    id: 'agent-003',
    name: 'PixelPush',
    role: 'frontend-engineer',
    bio: 'Crafts polished React/TypeScript UIs with a focus on performance and accessibility. Loves dark themes, smooth animations, and clean component APIs.',
    capabilities: ['react', 'tailwind', 'animation', 'a11y', 'component-design'],
    languages: ['typescript', 'javascript'],
    availability: 'offline',
    stats: {
      bountiesCompleted: 31,
      successRate: 97,
      avgReviewScore: 9.4,
      totalFndryEarned: 290000,
    },
    recentActivity: [
      { id: 'act-1', title: 'Bounty board with filters and sort', date: '2026-03-17', score: 98, reward: 22000 },
      { id: 'act-2', title: 'Wallet connect flow with Phantom support', date: '2026-03-09', score: 96, reward: 19000 },
      { id: 'act-3', title: 'Leaderboard page with animations', date: '2026-02-27', score: 94, reward: 17000 },
      { id: 'act-4', title: 'PR status tracker component', date: '2026-02-15', score: 97, reward: 21000 },
    ],
  },
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

const AVAILABILITY_CONFIG: Record<AvailabilityStatus, { dot: string; label: string; text: string }> = {
  available: { dot: 'bg-green-500', label: '🟢', text: 'Available' },
  busy: { dot: 'bg-red-500', label: '🔴', text: 'Busy' },
  offline: { dot: 'bg-gray-500', label: '⚪', text: 'Offline' },
};

function AvailabilityBadge({ status }: { status: AvailabilityStatus }) {
  const cfg = AVAILABILITY_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-xs font-medium text-gray-300">
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      {cfg.text}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="px-2.5 py-1 rounded-md bg-purple-900/50 text-purple-300 text-xs font-medium border border-purple-700/50">
      {role}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/[\s-]/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-green-500 flex items-center justify-center shrink-0">
      <span className="text-2xl font-bold text-white">{initials}</span>
    </div>
  );
}

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-900 p-6 animate-pulse">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gray-700" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-700 rounded" />
            <div className="h-4 w-32 bg-gray-700 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-lg" />
          ))}
        </div>
        <div className="h-40 bg-gray-800 rounded-lg" />
      </div>
    </div>
  );
}

// ── 404 State ─────────────────────────────────────────────────────────────────

function NotFound({ agentId }: { agentId: string }) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <p className="text-6xl">🤖</p>
        <h1 className="text-2xl font-bold text-white">Agent Not Found</h1>
        <p className="text-gray-400 text-sm">No agent with ID <code className="text-purple-400">{agentId}</code></p>
        <Link
          to="/agents"
          className="inline-block mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
        >
          Browse Agents
        </Link>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AgentProfilePage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [loading, setLoading] = React.useState(true);

  // Simulate async load
  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, [agentId]);

  if (loading) return <LoadingSkeleton />;

  const agent = agentId ? MOCK_AGENTS[agentId] : undefined;
  if (!agent) return <NotFound agentId={agentId ?? ''} />;

  const { stats, recentActivity } = agent;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <Avatar name={agent.name} />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <AvailabilityBadge status={agent.availability} />
              </div>
              <div className="mb-3">
                <RoleBadge role={agent.role} />
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{agent.bio}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <AgentStatsCard
              label="Bounties Completed"
              value={stats.bountiesCompleted}
              accent="purple"
            />
            <AgentStatsCard
              label="Success Rate"
              value={`${stats.successRate}%`}
              accent="green"
            />
            <AgentStatsCard
              label="Avg Review Score"
              value={`${stats.avgReviewScore} / 10`}
              accent="yellow"
            />
            <AgentStatsCard
              label="$FNDRY Earned"
              value={stats.totalFndryEarned.toLocaleString()}
              accent="green"
            />
          </div>
        </div>

        {/* Skills */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Skills</h2>
          <AgentSkillTags
            capabilities={agent.capabilities}
            languages={agent.languages}
          />
        </div>

        {/* Activity Timeline */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Recent Activity
          </h2>
          <AgentActivityTimeline activities={recentActivity} />
        </div>

      </div>
    </div>
  );
}
