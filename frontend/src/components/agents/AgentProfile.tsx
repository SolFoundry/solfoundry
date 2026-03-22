import { Link } from 'react-router-dom';
import type { AgentProfile as AgentProfileType } from '../../types/agent';
import { ROLE_LABELS, STATUS_CONFIG } from '../../types/agent';
import { AgentStatsCard } from './AgentStatsCard';
import { AgentSkillTags } from './AgentSkillTags';
import { AgentActivityTimeline } from './AgentActivityTimeline';

function AvailabilityBadge({ status }: { status: AgentProfileType['status'] }) {
  const { label, dot } = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-surface-300 bg-gray-100 dark:bg-surface-200 px-3 py-1 text-xs font-medium text-gray-300">
      <span className={`h-2.5 w-2.5 rounded-full ${dot} ${status === 'available' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: AgentProfileType['role'] }) {
  return (
    <span className="inline-flex items-center rounded-md bg-solana-purple/15 px-2.5 py-0.5 text-xs font-medium text-solana-purple border border-solana-purple/25">
      {ROLE_LABELS[role]}
    </span>
  );
}

function SuccessRateRing({ rate }: { rate: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const color = rate >= 90 ? '#14F195' : rate >= 80 ? '#FFD700' : '#FF6B6B';

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#2a2a2a" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{rate}%</span>
      </div>
    </div>
  );
}

interface AgentProfileProps {
  agent: AgentProfileType;
}

export function AgentProfile({ agent }: AgentProfileProps) {
  const memberSince = new Date(agent.joinedAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        to="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-solana-green transition-colors mb-6"
      >
        &larr; Back to Marketplace
      </Link>

      {/* ── Header Card ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-surface-300 bg-white dark:bg-surface-50 p-5 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Avatar + Success Ring on mobile stacked, desktop side by side */}
          <div className="flex flex-col items-center sm:items-start gap-4">
            <div className="h-20 w-20 rounded-full gradient-solana flex items-center justify-center text-2xl font-bold text-surface shrink-0">
              {agent.avatar}
            </div>
            <div className="sm:hidden">
              <SuccessRateRing rate={agent.successRate} />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{agent.name}</h1>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <RoleBadge role={agent.role} />
                <AvailabilityBadge status={agent.status} />
              </div>
            </div>
            <p className="text-sm text-gray-400 mb-3">Member since {memberSince}</p>
            <p className="text-sm text-gray-300 leading-relaxed max-w-2xl">{agent.bio}</p>
          </div>

          {/* Desktop success ring */}
          <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
            <SuccessRateRing rate={agent.successRate} />
            <span className="text-xs text-gray-500">Success Rate</span>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <AgentStatsCard
          label="Bounties"
          value={agent.bountiesCompleted.toString()}
          icon={<span className="text-solana-green">&#9889;</span>}
          accent="text-solana-green"
        />
        <AgentStatsCard
          label="Success Rate"
          value={`${agent.successRate}%`}
          icon={<span className="text-solana-green">&#10003;</span>}
          accent="text-solana-green"
        />
        <AgentStatsCard
          label="Avg Score"
          value={`${agent.avgReviewScore}/5`}
          icon={<span className="text-accent-gold">&#9733;</span>}
          accent="text-accent-gold"
        />
        <AgentStatsCard
          label="Total Earned"
          value={`${(agent.totalEarned / 1000).toFixed(0)}k $FNDRY`}
          icon={<span className="text-solana-purple">&#9670;</span>}
          accent="text-solana-purple"
        />
      </div>

      {/* ── Skills & Languages ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="rounded-xl border border-gray-200 dark:border-surface-300 bg-white dark:bg-surface-50 p-5">
          <AgentSkillTags title="Capabilities" tags={agent.skills} variant="green" />
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-surface-300 bg-white dark:bg-surface-50 p-5">
          <AgentSkillTags title="Languages" tags={agent.languages} variant="purple" />
        </div>
      </div>

      {/* ── Activity Timeline ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 dark:border-surface-300 bg-white dark:bg-surface-50 p-5 sm:p-6">
        <AgentActivityTimeline bounties={agent.completedBounties} />
      </div>
    </div>
  );
}
