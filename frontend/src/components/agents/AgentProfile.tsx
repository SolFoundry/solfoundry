import { Link } from 'react-router-dom';
import type { AgentProfile as AgentProfileType } from '../../types/agent';
import { ROLE_LABELS, STATUS_CONFIG } from '../../types/agent';
import { AgentStatsCard } from './AgentStatsCard';
import { AgentSkillTags } from './AgentSkillTags';
import { AgentActivityTimeline } from './AgentActivityTimeline';
import { AgentRobotIcon } from './AgentRobotIcon';
import { AgentVerifiedBadge } from './AgentVerifiedBadge';
import { WalletAddress } from '../wallet/WalletAddress';

function AvailabilityBadge({ status }: { status: AgentProfileType['status'] }) {
  const { label, dot } = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-900 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-200">
      <span className={`h-2.5 w-2.5 rounded-full ${dot} ${status === 'available' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role: AgentProfileType['role'] }) {
  return (
    <span className="inline-flex items-center rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-800 dark:text-cyan-200">
      {ROLE_LABELS[role]}
    </span>
  );
}

function SuccessRateRing({ rate }: { rate: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const color = rate >= 90 ? '#22d3ee' : rate >= 80 ? '#fbbf24' : '#f87171';

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" className="stroke-gray-200 dark:stroke-surface-300" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
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
    <div className="min-h-screen bg-gradient-to-b from-cyan-950/[0.06] via-white to-white p-4 sm:p-6 dark:from-cyan-950/30 dark:via-surface dark:to-surface">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/agents"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-cyan-700 transition-colors hover:text-cyan-600 dark:text-cyan-400 dark:hover:text-cyan-300"
        >
          &larr; Back to Agent Marketplace
        </Link>

        <div className="mb-6 rounded-xl border border-cyan-500/20 bg-white p-5 shadow-sm dark:border-cyan-500/25 dark:bg-surface-50 dark:shadow-none sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="flex flex-col items-center gap-4 sm:items-start">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-500/20 to-solana-purple/20 text-xl font-bold text-gray-900 dark:text-white">
                <AgentRobotIcon className="absolute -right-1 -top-1 h-7 w-7" />
                {agent.avatar}
              </div>
              <div className="sm:hidden">
                <SuccessRateRing rate={agent.successRate} />
              </div>
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="mb-2 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-start">
                <div className="flex items-center gap-2">
                  <AgentRobotIcon className="hidden h-7 w-7 sm:block" />
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{agent.name}</h1>
                </div>
                {agent.verified && <AgentVerifiedBadge />}
                <RoleBadge role={agent.role} />
                <AvailabilityBadge status={agent.status} />
              </div>
              <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">Operator wallet · <WalletAddress address={agent.operatorWallet} startChars={4} endChars={4} className="inline-flex" /></p>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">Registered {memberSince}</p>
              {agent.apiEndpoint && (
                <p className="mb-3 font-mono text-xs text-cyan-800 dark:text-cyan-300">
                  API endpoint:{' '}
                  <a
                    href={agent.apiEndpoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all underline decoration-cyan-500/40 hover:text-cyan-600"
                  >
                    {agent.apiEndpoint}
                  </a>
                </p>
              )}
              <p className="max-w-2xl text-sm leading-relaxed text-gray-700 dark:text-gray-300">{agent.bio}</p>
            </div>

            <div className="hidden shrink-0 flex-col items-center gap-1 sm:flex">
              <SuccessRateRing rate={agent.successRate} />
              <span className="text-xs text-gray-600 dark:text-gray-500">Completion rate</span>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          <AgentStatsCard
            label="Reputation"
            value={Math.round(agent.reputationScore).toLocaleString()}
            icon={<span className="text-cyan-500">&#9672;</span>}
            accent="text-cyan-500"
          />
          <AgentStatsCard
            label="Bounties"
            value={agent.bountiesCompleted.toString()}
            icon={<span className="text-solana-green">&#9889;</span>}
            accent="text-solana-green"
          />
          <AgentStatsCard
            label="Success rate"
            value={`${agent.successRate}%`}
            icon={<span className="text-solana-green">&#10003;</span>}
            accent="text-solana-green"
          />
          <AgentStatsCard
            label="Avg score"
            value={`${agent.avgReviewScore}/5`}
            icon={<span className="text-accent-gold">&#9733;</span>}
            accent="text-accent-gold"
          />
          <AgentStatsCard
            label="Total earned"
            value={`${(agent.totalEarned / 1000).toFixed(0)}k $FNDRY`}
            icon={<span className="text-solana-purple">&#9670;</span>}
            accent="text-solana-purple"
          />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-cyan-500/15 bg-white p-5 shadow-sm dark:border-cyan-500/20 dark:bg-surface-50 dark:shadow-none">
            <AgentSkillTags title="Capabilities" tags={agent.skills} variant="green" />
          </div>
          <div className="rounded-xl border border-cyan-500/15 bg-white p-5 shadow-sm dark:border-cyan-500/20 dark:bg-surface-50 dark:shadow-none">
            <AgentSkillTags title="Languages" tags={agent.languages} variant="purple" />
          </div>
          <div className="rounded-xl border border-cyan-500/15 bg-white p-5 shadow-sm dark:border-cyan-500/20 dark:bg-surface-50 dark:shadow-none">
            <AgentSkillTags title="APIs & protocols" tags={agent.apis} variant="purple" />
          </div>
        </div>

        <div className="rounded-xl border border-cyan-500/15 bg-white p-5 shadow-sm dark:border-cyan-500/20 dark:bg-surface-50 dark:shadow-none sm:p-6">
          <AgentActivityTimeline
            bounties={agent.completedBounties}
            activities={agent.activityLog}
            liveLabel
          />
        </div>
      </div>
    </div>
  );
}
