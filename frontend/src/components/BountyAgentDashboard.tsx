/**
 * BountyAgentDashboard — Real-time monitoring dashboard for the
 * Autonomous Bounty-Hunting Agent system.
 *
 * Displays mission status, agent states, discovered bounties,
 * pipeline progress, event log, and control buttons.
 *
 * @module components/BountyAgentDashboard
 */

import React, { useMemo } from 'react';
import { useBountyAgent, useStageProgress, type StageProgress } from '../hooks/useBountyAgent';
import type { AgentEvent, DiscoveredBounty } from '../api/bounty-agent';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Status badge with color coding. */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-700',
    waiting: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  const icon: Record<string, string> = {
    idle: '○',
    running: '◌',
    waiting: '◷',
    completed: '✓',
    failed: '✗',
    cancelled: '✕',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.idle}`}
    >
      <span>{icon[status] ?? '○'}</span>
      {status}
    </span>
  );
}

/** Pipeline stage progress indicator. */
function StageProgressItem({ stage }: { stage: StageProgress }) {
  const statusColors: Record<string, string> = {
    pending: 'border-gray-200 bg-gray-50',
    running: 'border-blue-400 bg-blue-50',
    completed: 'border-green-400 bg-green-50',
    failed: 'border-red-400 bg-red-50',
  };

  return (
    <div className={`flex items-center gap-2 rounded-lg border p-3 ${statusColors[stage.status]}`}>
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold">
        {stage.status === 'completed' ? '✓' : stage.status === 'failed' ? '✗' : stage.progress}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium">{stage.label}</div>
        <div className="text-xs text-gray-500">{stage.status}</div>
      </div>
      <div className="w-16">
        <div className="h-1.5 rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${stage.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/** Bounty card for discovered bounties. */
function BountyCard({ bounty }: { bounty: DiscoveredBounty }) {
  const scoreColor =
    bounty.skillMatchScore >= 0.7
      ? 'text-green-600'
      : bounty.skillMatchScore >= 0.4
        ? 'text-yellow-600'
        : 'text-red-600';

  return (
    <div
      className={`rounded-lg border p-4 transition-shadow hover:shadow-md ${bounty.shouldPursue ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between">
        <h4 className="font-medium text-gray-900">{bounty.title}</h4>
        <span className="text-lg font-bold text-green-600">${bounty.rewardAmount}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-gray-500">Skill Match</div>
          <div className={`font-medium ${scoreColor}`}>
            {Math.round(bounty.skillMatchScore * 100)}%
          </div>
        </div>
        <div>
          <div className="text-gray-500">Difficulty</div>
          <div className="font-medium">{bounty.estimatedDifficulty}/10</div>
        </div>
        <div>
          <div className="text-gray-500">Effort</div>
          <div className="font-medium">{bounty.estimatedEffortHours}h</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">Value ratio: {bounty.valueRatio.toFixed(1)}</span>
        {bounty.shouldPursue && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            Recommended
          </span>
        )}
      </div>
    </div>
  );
}

/** Event log entry. */
function EventLogEntry({ event }: { event: AgentEvent }) {
  const typeColors: Record<string, string> = {
    agent_started: 'text-blue-600',
    agent_completed: 'text-green-600',
    agent_error: 'text-red-600',
    bounty_discovered: 'text-purple-600',
    bounty_selected: 'text-green-600',
    solution_started: 'text-blue-600',
    solution_completed: 'text-green-600',
    tests_started: 'text-blue-600',
    tests_completed: 'text-green-600',
    pr_started: 'text-blue-600',
    pr_submitted: 'text-green-600',
    pr_failed: 'text-red-600',
    mission_complete: 'text-green-700',
    mission_failed: 'text-red-700',
    status_update: 'text-gray-600',
  };

  return (
    <div className="flex items-start gap-2 py-1 text-xs">
      <span className="shrink-0 text-gray-400">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
      <span className={`shrink-0 font-medium ${typeColors[event.type] ?? 'text-gray-500'}`}>
        [{event.agent}]
      </span>
      <span className="text-gray-700">{event.message}</span>
    </div>
  );
}

/** Agent status grid. */
function AgentStatusGrid({
  agentStates,
}: {
  agentStates: Record<string, string>;
}) {
  const agentLabels: Record<string, string> = {
    planner: 'Planner',
    coder: 'Coder',
    tester: 'Tester',
    submitter: 'Submitter',
    orchestrator: 'Orchestrator',
  };

  return (
    <div className="grid grid-cols-5 gap-2">
      {Object.entries(agentStates).map(([role, state]) => (
        <div key={role} className="rounded-lg border bg-white p-3 text-center">
          <div className="text-xs font-medium text-gray-500">{agentLabels[role] ?? role}</div>
          <div className="mt-1">
            <StatusBadge status={state} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

/** Props for the BountyAgentDashboard. */
export interface BountyAgentDashboardProps {
  /** Whether to enable real-time polling (default: true). */
  pollingEnabled?: boolean;
  /** Custom class name for the container. */
  className?: string;
}

/**
 * Dashboard component for monitoring the Autonomous Bounty-Hunting Agent.
 *
 * Provides a complete view of the agent system including:
 * - Mission status and controls
 * - Agent states
 * - Pipeline progress
 * - Discovered bounties
 * - Event log
 *
 * @param props - Component props.
 * @returns Dashboard JSX element.
 *
 * @example
 * ```tsx
 * <BountyAgentDashboard pollingEnabled={true} />
 * ```
 */
export default function BountyAgentDashboard({
  pollingEnabled = true,
  className = '',
}: BountyAgentDashboardProps) {
  const {
    mission,
    isMissionLoading,
    bounties,
    isBountiesLoading,
    events,
    isEventsLoading,
    lastPR,
    startMission,
    stopMission,
    resetMission,
    runStage,
    isMutating,
  } = useBountyAgent({ enabled: pollingEnabled });

  const stageProgress = useStageProgress(mission);

  const recentEvents = useMemo(() => {
    return events.slice(0, 20);
  }, [events]);

  const topBounties = useMemo(() => {
    return bounties
      .filter((b) => b.shouldPursue)
      .sort((a, b) => b.valueRatio - a.valueRatio)
      .slice(0, 5);
  }, [bounties]);

  return (
    <div className={`space-y-6 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bounty Agent Dashboard</h1>
          <p className="text-sm text-gray-500">
            Autonomous bounty-hunting agent system
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mission && (
            <StatusBadge
              status={
                mission.isComplete
                  ? 'completed'
                  : mission.isFailed
                    ? 'failed'
                    : mission.isActive
                      ? 'running'
                      : 'idle'
              }
            />
          )}
        </div>
      </div>

      {/* Mission Controls */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Mission Control</h2>
        <div className="flex gap-2">
          <button
            onClick={() => startMission()}
            disabled={isMutating || mission?.isActive}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isMutating ? 'Starting...' : 'Start Mission'}
          </button>
          <button
            onClick={stopMission}
            disabled={isMutating || !mission?.isActive}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isMutating ? 'Stopping...' : 'Stop Mission'}
          </button>
          <button
            onClick={resetMission}
            disabled={isMutating}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        {/* Stage controls */}
        <div className="mt-3 flex gap-1">
          {stageProgress.map((stage) => (
            <button
              key={stage.stage}
              onClick={() => runStage(stage.stage)}
              disabled={isMutating}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                stage.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : stage.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : stage.status === 'running'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Pipeline Progress</h2>
        <div className="space-y-2">
          {stageProgress.map((stage) => (
            <StageProgressItem key={stage.stage} stage={stage} />
          ))}
        </div>
      </div>

      {/* Agent States */}
      {mission && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Agent States</h2>
          <AgentStatusGrid agentStates={mission.agentStates} />
        </div>
      )}

      {/* Discovered Bounties */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Discovered Bounties{' '}
          <span className="font-normal text-gray-400">
            ({bounties.length} total, {topBounties.length} recommended)
          </span>
        </h2>
        {isBountiesLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading bounties...</div>
        ) : topBounties.length > 0 ? (
          <div className="space-y-2">
            {topBounties.map((bounty) => (
              <BountyCard key={bounty.bountyId} bounty={bounty} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-gray-400">
            {bounties.length === 0
              ? 'No bounties discovered yet. Start a mission to discover bounties.'
              : 'No bounties match the current criteria.'}
          </div>
        )}
      </div>

      {/* Event Log */}
      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Event Log</h2>
        {isEventsLoading ? (
          <div className="py-4 text-center text-sm text-gray-400">Loading events...</div>
        ) : recentEvents.length > 0 ? (
          <div className="max-h-64 space-y-0.5 overflow-y-auto">
            {recentEvents.map((event, index) => (
              <EventLogEntry key={`${event.timestamp}-${index}`} event={event} />
            ))}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-gray-400">
            No events yet. Events will appear when the agent is running.
          </div>
        )}
      </div>

      {/* Last PR Result */}
      {lastPR && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Last PR Submission</h2>
          {lastPR.success ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✓</span>
                <span className="font-medium text-green-700">PR Submitted Successfully</span>
              </div>
              <a
                href={lastPR.prUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {lastPR.prUrl}
              </a>
              <div className="text-xs text-gray-500">
                Branch: {lastPR.branchName}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <span>✗</span>
              <span>PR Failed: {lastPR.error}</span>
            </div>
          )}
        </div>
      )}

      {/* Mission Info */}
      {mission && (
        <div className="rounded-xl border bg-gray-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Mission Details</h2>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-gray-500">Mission ID</dt>
              <dd className="font-mono">{mission.missionId}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Current Stage</dt>
              <dd className="capitalize">{mission.currentStage}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Created</dt>
              <dd>{new Date(mission.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Last Updated</dt>
              <dd>{new Date(mission.updatedAt).toLocaleString()}</dd>
            </div>
            {mission.bountyId && (
              <div>
                <dt className="text-gray-500">Target Bounty</dt>
                <dd className="font-mono">{mission.bountyId}</dd>
              </div>
            )}
            {mission.errorMessage && (
              <div className="col-span-2">
                <dt className="text-red-500">Error</dt>
                <dd className="text-red-600">{mission.errorMessage}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
