/**
 * BountyAgentDashboard — Real-time monitoring dashboard for the
 * Autonomous Bounty-Hunting Agent system (multi-agent, multi-gateway).
 *
 * Features:
 * - Mission control (start/stop/reset autonomous cycle)
 * - Pipeline stage progress visualization
 * - Agent status grid (agents across gateways)
 * - Economic system balance display (ClawTasks → agent-token → MoltsPay)
 * - Bounty progress tracking with reward amounts
 * - Relay message stream (bot-to-bot communication log)
 * - Discovered bounties list with skill-match scoring
 * - Event log with real-time updates
 * - WebSocket real-time connection with auto-reconnect
 * - Confidence & anti-hallucination metrics dashboard
 * - Scheduler queue visualization with agent ratings
 * - Disaster recovery status panel
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useBountyAgentWebSocket,
  useSchedulerStatus,
  useConfidenceMetrics,
  useDisasterRecovery,
  type WSConnectionState,
  type SchedulerStatus,
  type ConfidenceMetrics,
  type DisasterRecoveryStatus,
} from '../hooks/useBountyAgent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentNode {
  agent_id: string;
  department: string;
  model: string;
  gateway: number;
  status: 'idle' | 'busy' | 'error';
  tasks_completed: number;
}

interface GatewayStatus {
  gw_id: number;
  port: number;
  active_agents: number;
  max_concurrent: number;
  capacity: number;
}

interface MissionStatus {
  mission_id: string | null;
  bounty_id: string | null;
  current_stage: 'idle' | 'discover' | 'analyze' | 'implement' | 'submit' | 'complete' | 'failed';
  is_active: boolean;
  is_complete: boolean;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface DiscoveredBounty {
  bounty_id: string;
  title: string;
  platform: string;
  reward: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  skill_match_score: number;
  estimated_effort_hours: number;
  url: string;
  is_easy: boolean;
}

interface EconomicBalance {
  claw_tasks_earned: number;
  agent_token_balance: number;
  moltspay_pending: number;
  moltspay_settled: number;
  total_usd_equivalent: number;
}

interface RelayMessage {
  id: string;
  from_agent: string;
  to_agent: string;
  message_type: 'task_assign' | 'review_request' | 'escalation' | 'status_update';
  content: string;
  timestamp: string;
  hop_count: number;
}

interface AgentEvent {
  type: string;
  timestamp: string;
  agent: string;
  department: string;
  message: string;
}

interface TeamStatus {
  total_agents: number;
  gateways: number;
  idle: number;
  busy: number;
  error: number;
  total_completed: number;
}

// ---------------------------------------------------------------------------
// API Functions (mock — replace with real endpoints in production)
// ---------------------------------------------------------------------------

const API_BASE = '/api/bounty-agent';

async function fetchMissionStatus(): Promise<MissionStatus> {
  const res = await fetch(`${API_BASE}/mission`);
  if (!res.ok) throw new Error('Failed to fetch mission status');
  return res.json();
}

async function fetchTeamStatus(): Promise<TeamStatus> {
  const res = await fetch(`${API_BASE}/team`);
  if (!res.ok) throw new Error('Failed to fetch team status');
  return res.json();
}

async function fetchAgents(): Promise<AgentNode[]> {
  const res = await fetch(`${API_BASE}/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

async function fetchGateways(): Promise<GatewayStatus[]> {
  const res = await fetch(`${API_BASE}/gateways`);
  if (!res.ok) throw new Error('Failed to fetch gateways');
  return res.json();
}

async function fetchBounties(): Promise<DiscoveredBounty[]> {
  const res = await fetch(`${API_BASE}/bounties`);
  if (!res.ok) throw new Error('Failed to fetch bounties');
  return res.json();
}

async function fetchEconomicBalance(): Promise<EconomicBalance> {
  const res = await fetch(`${API_BASE}/economics`);
  if (!res.ok) throw new Error('Failed to fetch economic balance');
  return res.json();
}

async function fetchRelayMessages(): Promise<RelayMessage[]> {
  const res = await fetch(`${API_BASE}/relay?limit=20`);
  if (!res.ok) throw new Error('Failed to fetch relay messages');
  return res.json();
}

async function fetchEvents(): Promise<AgentEvent[]> {
  const res = await fetch(`${API_BASE}/events?limit=50`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

async function startMission(): Promise<void> {
  const res = await fetch(`${API_BASE}/mission/start`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start mission');
}

async function stopMission(): Promise<void> {
  const res = await fetch(`${API_BASE}/mission/stop`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to stop mission');
}

async function resetMission(): Promise<void> {
  const res = await fetch(`${API_BASE}/mission/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset mission');
}

async function runStage(stage: string): Promise<void> {
  const res = await fetch(`${API_BASE}/mission/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });
  if (!res.ok) throw new Error(`Failed to run stage: ${stage}`);
}

async function selectBounty(bountyId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/bounties/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bounty_id: bountyId }),
  });
  if (!res.ok) throw new Error('Failed to select bounty');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STAGE_ORDER = ['discover', 'analyze', 'implement', 'submit'] as const;
const STAGE_LABELS: Record<string, string> = {
  idle: 'Idle',
  discover: 'Discover',
  analyze: 'Analyze',
  implement: 'Implement',
  submit: 'Submit',
  complete: 'Complete',
  failed: 'Failed',
};

const DEPARTMENT_COLORS: Record<string, string> = {
  '铁卫': 'bg-red-500',
  '天机': 'bg-blue-500',
  '玄码': 'bg-green-500',
  '博典': 'bg-yellow-500',
  '运维': 'bg-purple-500',
  SECURITY: 'bg-red-500',
  RESEARCH: 'bg-blue-500',
  CODE: 'bg-green-500',
  KNOWLEDGE: 'bg-yellow-500',
  OPS: 'bg-purple-500',
};

const DEPARTMENT_ICONS: Record<string, string> = {
  '铁卫': '🛡️',
  '天机': '🔍',
  '玄码': '💻',
  '博典': '📚',
  '运维': '⚙️',
  SECURITY: '🛡️',
  RESEARCH: '🔍',
  CODE: '💻',
  KNOWLEDGE: '📚',
  OPS: '⚙️',
};

function PipelineProgress({ currentStage }: { currentStage: string }) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage as typeof STAGE_ORDER[number]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline Progress</h3>
      <div className="flex items-center gap-2">
        {STAGE_ORDER.map((stage, idx) => {
          const isComplete = idx < currentIndex;
          const isCurrent = stage === currentStage;
          const isPending = idx > currentIndex;

          return (
            <React.Fragment key={stage}>
              <div className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all
                ${isComplete ? 'bg-green-100 text-green-800' : ''}
                ${isCurrent ? 'bg-blue-100 text-blue-800 ring-2 ring-blue-400 animate-pulse' : ''}
                ${isPending ? 'bg-gray-100 text-gray-400' : ''}
              `}>
                {isComplete && <span>✅</span>}
                {isCurrent && <span>🔄</span>}
                {isPending && <span>⏳</span>}
                <span>{STAGE_LABELS[stage]}</span>
              </div>
              {idx < STAGE_ORDER.length - 1 && (
                <div className={`h-0.5 w-8 ${isComplete ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function AgentStatusGrid({ agents }: { agents: AgentNode[] }) {
  const departments = useMemo(() => {
    const map = new Map<string, AgentNode[]>();
    for (const agent of agents) {
      const dept = agent.department;
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(agent);
    }
    return map;
  }, [agents]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Agent Status Grid
        <span className="ml-2 text-sm font-normal text-gray-500">{agents.length} agents</span>
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from(departments.entries()).map(([dept, deptAgents]) => {
          const busy = deptAgents.filter(a => a.status === 'busy').length;
          const idle = deptAgents.filter(a => a.status === 'idle').length;
          const error = deptAgents.filter(a => a.status === 'error').length;
          const icon = DEPARTMENT_ICONS[dept] || '🤖';
          const color = DEPARTMENT_COLORS[dept] || 'bg-gray-500';

          return (
            <div key={dept} className="border border-gray-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{icon}</span>
                <span className="font-medium text-gray-800">{dept}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                  {idle} idle
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  {busy} busy
                </span>
                {error > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                    {error} err
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-0.5">
                {deptAgents.slice(0, 13).map(agent => (
                  <div
                    key={agent.agent_id}
                    className={`w-2 h-2 rounded-full ${
                      agent.status === 'busy' ? color :
                      agent.status === 'error' ? 'bg-red-400' :
                      'bg-gray-300'
                    }`}
                    title={`${agent.agent_id} (${agent.model}) — ${agent.status}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EconomicSystemPanel({ balance }: { balance: EconomicBalance }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">💰 Economic System</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">
            {balance.claw_tasks_earned.toLocaleString()}
          </div>
          <div className="text-xs text-blue-500 mt-1">ClawTasks Earned</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">
            {balance.agent_token_balance.toLocaleString()}
          </div>
          <div className="text-xs text-purple-500 mt-1">Agent-Token Balance</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">
            {balance.moltspay_pending.toLocaleString()}
          </div>
          <div className="text-xs text-orange-500 mt-1">MoltsPay Pending</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-700">
            ${balance.total_usd_equivalent.toFixed(2)}
          </div>
          <div className="text-xs text-green-500 mt-1">Total USD Equivalent</div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
        <span>ClawTasks</span>
        <span>→</span>
        <span>agent-token</span>
        <span>→</span>
        <span>MoltsPay</span>
        <span className="ml-auto">
          Settled: {balance.moltspay_settled.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function BountyProgressList({ bounties }: { bounties: DiscoveredBounty[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🎯 Discovered Bounties
        <span className="ml-2 text-sm font-normal text-gray-500">{bounties.length} found</span>
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {bounties.map(bounty => (
          <button
            key={bounty.bounty_id}
            onClick={() => setSelectedId(bounty.bounty_id === selectedId ? null : bounty.bounty_id)}
            className={`w-full text-left p-3 rounded-lg border transition-all ${
              bounty.bounty_id === selectedId
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    bounty.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                    bounty.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                    bounty.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {bounty.difficulty}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {bounty.title}
                  </span>
                </div>
                {bounty.bounty_id === selectedId && (
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <div>Platform: {bounty.platform}</div>
                    <div>Effort: ~{bounty.estimated_effort_hours}h | Match: {(bounty.skill_match_score * 100).toFixed(0)}%</div>
                    <a href={bounty.url} target="_blank" rel="noopener noreferrer"
                       className="text-blue-500 hover:underline">
                      View on GitHub →
                    </a>
                  </div>
                )}
              </div>
              <div className="ml-4 text-right">
                <div className="text-sm font-bold text-gray-900">{bounty.reward}</div>
                <div className="w-16 bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${bounty.skill_match_score * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RelayMessageStream({ messages }: { messages: RelayMessage[] }) {
  const TYPE_ICONS: Record<string, string> = {
    task_assign: '📋',
    review_request: '👀',
    escalation: '🚨',
    status_update: '📡',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📡 Agent Relay Stream
        <span className="ml-2 text-sm font-normal text-gray-500">{messages.length} messages</span>
      </h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {messages.map(msg => (
          <div key={msg.id} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5">{TYPE_ICONS[msg.message_type] || '💬'}</span>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-blue-600">{msg.from_agent}</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="font-mono text-purple-600">{msg.to_agent}</span>
              <span className="text-gray-600 ml-2 truncate">{msg.content}</span>
            </div>
            <span className="text-gray-400 shrink-0">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EventLog({ events }: { events: AgentEvent[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        📜 Event Log
      </h3>
      <div className="space-y-1 max-h-48 overflow-y-auto font-mono text-xs">
        {events.map((event, idx) => (
          <div key={idx} className="flex gap-2 text-gray-600">
            <span className="text-gray-400 shrink-0">
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 ${
              event.department === '铁卫' || event.department === 'SECURITY' ? 'text-red-500' :
              event.department === '天机' || event.department === 'RESEARCH' ? 'text-blue-500' :
              event.department === '玄码' || event.department === 'CODE' ? 'text-green-500' :
              'text-gray-500'
            }`>
              [{event.agent}]
            </span>
            <span className="truncate">{event.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence & Anti-Hallucination Dashboard
// ---------------------------------------------------------------------------

function ConfidenceDashboard({ metrics }: { metrics: ConfidenceMetrics }) {
  const gaugeItems = [
    { label: 'Overall', value: metrics.overall_confidence, color: 'blue' },
    { label: 'Discovery', value: metrics.discovery_confidence, color: 'green' },
    { label: 'Analysis', value: metrics.analysis_confidence, color: 'purple' },
    { label: 'Implementation', value: metrics.implementation_confidence, color: 'indigo' },
    { label: 'Submission', value: metrics.submission_confidence, color: 'teal' },
  ];

  const colorMap: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    teal: 'text-teal-600',
  };

  const bgMap: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
    teal: 'bg-teal-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🎯 Confidence & Anti-Hallucination
      </h3>

      {/* Confidence Gauges */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {gaugeItems.map(item => (
          <div key={item.label} className="text-center">
            <div className="relative w-16 h-16 mx-auto">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="#e5e7eb" strokeWidth="3"
                />
                <path
n                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${item.value * 100}, 100`}
                  className={colorMap[item.color]}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold ${colorMap[item.color]}`}>
                  {(item.value * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Anti-Hallucination & Cross-Review */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-orange-600">
            {(metrics.anti_hallucination_score * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-orange-500 mt-1">Anti-Hallucination</div>
        </div>
        <div className="bg-cyan-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-cyan-600">
            {(metrics.cross_review_agreement * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-cyan-500 mt-1">Cross-Review Agreement</div>
        </div>
        <div className="bg-violet-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-violet-600">
            {(metrics.model_consensus * 100).toFixed(0)}%
          </div>
          <div className="text-xs text-violet-500 mt-1">Model Consensus</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scheduler Queue Panel
// ---------------------------------------------------------------------------

function SchedulerQueuePanel({ scheduler }: { scheduler: SchedulerStatus }) {
  const gradeColors: Record<string, string> = {
    S: 'bg-yellow-100 text-yellow-800',
    A: 'bg-green-100 text-green-800',
    B: 'bg-blue-100 text-blue-800',
    C: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        ⚙️ Scheduler Queue
      </h3>

      {/* Queue Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-gray-800">{scheduler.queue_length}</div>
          <div className="text-xs text-gray-500">Queued</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-600">{scheduler.active_tasks}</div>
          <div className="text-xs text-blue-500">Active</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-600">{scheduler.completed_today}</div>
          <div className="text-xs text-green-500">Completed Today</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-purple-600">{scheduler.avg_wait_time_ms}ms</div>
          <div className="text-xs text-purple-500">Avg Wait</div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Memory: {scheduler.memory_usage_mb}MB / {scheduler.memory_limit_mb}MB</span>
          <span>{((scheduler.memory_usage_mb / scheduler.memory_limit_mb) * 100).toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              scheduler.memory_usage_mb / scheduler.memory_limit_mb > 0.85 ? 'bg-red-500' :
              scheduler.memory_usage_mb / scheduler.memory_limit_mb > 0.6 ? 'bg-yellow-500' :
              'bg-green-500'
            }`}
            style={{ width: `${(scheduler.memory_usage_mb / scheduler.memory_limit_mb) * 100}%` }}
          />
        </div>
      </div>

      {/* Agent Ratings */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">Agent Ratings (S/A/B/C)</h4>
        <div className="flex flex-wrap gap-1">
          {Object.entries(scheduler.agent_ratings).slice(0, 20).map(([agentId, rating]) => (
            <span
              key={agentId}
              className={`text-xs px-2 py-0.5 rounded-full font-mono ${gradeColors[rating.grade] || 'bg-gray-100'}`}
              title={`${agentId}: Grade ${rating.grade}, Score ${rating.score}, Tasks ${rating.tasks_completed}`}
            >
              {agentId.replace('agent-', '')}:{rating.grade}
            </span>
          ))}
        </div>
      </div>

      {/* Queue Items */}
      {scheduler.queue.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 mb-2">Pending Queue</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {scheduler.queue.map((entry, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                <span className="font-mono text-blue-600">{entry.agent_id}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">{entry.department}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-800 truncate">{entry.task}</span>
                <span className="ml-auto text-gray-400">P{entry.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disaster Recovery Panel
// ---------------------------------------------------------------------------

function DisasterRecoveryPanel({ status }: { status: DisasterRecoveryStatus }) {
  const statusColors: Record<string, string> = {
    healthy: 'text-green-600',
    degraded: 'text-yellow-600',
    failed: 'text-red-600',
  };

  const statusIcons: Record<string, string> = {
    healthy: '✅',
    degraded: '⚠️',
    failed: '❌',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        🛡️ Disaster Recovery
      </h3>
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className={`text-lg ${statusColors[status.data_layer_status]}`}>
            {statusIcons[status.data_layer_status]} {status.data_layer_status}
          </div>
          <div className="text-xs text-gray-500 mt-1">Data Layer</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className={`text-lg ${statusColors[status.app_layer_status]}`}>
            {statusIcons[status.app_layer_status]} {status.app_layer_status}
          </div>
          <div className="text-xs text-gray-500 mt-1">App Layer</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className={`text-lg ${statusColors[status.business_layer_status]}`}>
            {statusIcons[status.business_layer_status]} {status.business_layer_status}
          </div>
          <div className="text-xs text-gray-500 mt-1">Business Layer</div>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className={`text-lg ${
            status.backup_status === '3-2-1-compliant' ? 'text-green-600' :
            status.backup_status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {status.backup_status === '3-2-1-compliant' ? '✅' :
             status.backup_status === 'degraded' ? '⚠️' : '❌'}
            {status.backup_status.replace('3-2-1-compliant', '3-2-1')}
          </div>
          <div className="text-xs text-gray-500 mt-1">Backup</div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span>Checkpoint: {status.checkpoint_enabled ? 'ON' : 'OFF'}</span>
        <span>Last: {status.last_checkpoint_at ? new Date(status.last_checkpoint_at).toLocaleTimeString() : 'N/A'}</span>
        <span>Interval: {status.checkpoint_interval_s}s</span>
        <span>Recoveries: {status.recovery_count}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WebSocket Status Bar
// ---------------------------------------------------------------------------

function WebSocketStatusBar({ wsState }: { wsState: WSConnectionState }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
        wsState.isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          wsState.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`} />
        <span className="font-medium">
          {wsState.isConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
        </span>
      </div>
      {wsState.isConnected && (
        <>
          <span className="text-gray-400">Latency: {wsState.latency}ms</span>
          <span className="text-gray-400">Reconnects: {wsState.reconnectCount}</span>
          {wsState.lastMessageAt && (
            <span className="text-gray-400">
              Last msg: {new Date(wsState.lastMessageAt).toLocaleTimeString()}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Component
// ---------------------------------------------------------------------------

export default function BountyAgentDashboard() {
  const queryClient = useQueryClient();
  const [selectedBounty, setSelectedBounty] = useState<string | null>(null);

  // Queries — auto-refresh every 5s
  const missionQ = useQuery({
    queryKey: ['mission'],
    queryFn: fetchMissionStatus,
    refetchInterval: 5000,
  });

  const teamQ = useQuery({
    queryKey: ['team'],
    queryFn: fetchTeamStatus,
    refetchInterval: 5000,
  });

  const agentsQ = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 10000,
  });

  const gatewaysQ = useQuery({
    queryKey: ['gateways'],
    queryFn: fetchGateways,
    refetchInterval: 10000,
  });

  const bountiesQ = useQuery({
    queryKey: ['bounties'],
    queryFn: fetchBounties,
    refetchInterval: 30000,
  });

  const economicQ = useQuery({
    queryKey: ['economics'],
    queryFn: fetchEconomicBalance,
    refetchInterval: 15000,
  });

  const relayQ = useQuery({
    queryKey: ['relay'],
    queryFn: fetchRelayMessages,
    refetchInterval: 5000,
  });

  const eventsQ = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents,
    refetchInterval: 5000,
  });

  // New hooks
  const wsState = useBountyAgentWebSocket();
  const schedulerQ = useSchedulerStatus();
  const confidenceQ = useConfidenceMetrics();
  const disasterQ = useDisasterRecovery();

  // Mutations
  const startMut = useMutation({
    mutationFn: startMission,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mission'] }),
  });

  const stopMut = useMutation({
    mutationFn: stopMission,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mission'] }),
  });

  const resetMut = useMutation({
    mutationFn: resetMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });

  const stageMut = useMutation({
    mutationFn: runStage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mission'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });

  const selectBountyMut = useMutation({
    mutationFn: selectBounty,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mission'] }),
  });

  const handleSelectBounty = useCallback((bountyId: string) => {
    setSelectedBounty(bountyId);
    selectBountyMut.mutate(bountyId);
  }, [selectBountyMut]);

  const mission = missionQ.data;
  const team = teamQ.data;
  const agents = agentsQ.data ?? [];
  const gateways = gatewaysQ.data ?? [];
  const bounties = bountiesQ.data ?? [];
  const economic = economicQ.data;
  const relayMessages = relayQ.data ?? [];
  const events = eventsQ.data ?? [];
  const scheduler = schedulerQ.data;
  const confidence = confidenceQ.data;
  const disasterRecovery = disasterQ.data;

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            🤖 Bounty Agent Dashboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {team ? `${team.total_agents} agents | ${team.gateways} gateways | Multi-LLM` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Mission Control */}
          <button
            onClick={() => startMut.mutate()}
            disabled={mission?.is_active || startMut.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium
                       hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {startMut.isPending ? 'Starting...' : '▶ Start Mission'}
          </button>
          <button
            onClick={() => stopMut.mutate()}
            disabled={!mission?.is_active || stopMut.isPending}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium
                       hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            ⏹ Stop
          </button>
          <button
            onClick={() => resetMut.mutate()}
            disabled={resetMut.isPending}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium
                       hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-green-600">{team?.idle ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Idle Agents</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">{team?.busy ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Busy Agents</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-purple-600">{team?.total_completed ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Tasks Completed</div>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 text-center">
          <div className={`text-2xl font-bold ${
            mission?.current_stage === 'complete' ? 'text-green-600' :
            mission?.current_stage === 'failed' ? 'text-red-600' :
            mission?.is_active ? 'text-blue-600' : 'text-gray-400'
          }`}>
            {mission ? STAGE_LABELS[mission.current_stage] : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Current Stage</div>
        </div>
      </div>

      {/* Pipeline Progress */}
      {mission && <PipelineProgress currentStage={mission.current_stage} />}

      {/* Stage Control Buttons */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Stage Control</h3>
        <div className="flex gap-2">
          {STAGE_ORDER.map(stage => (
            <button
              key={stage}
              onClick={() => stageMut.mutate(stage)}
              disabled={stageMut.isPending}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium
                         hover:bg-blue-100 hover:text-blue-700 disabled:opacity-50
                         transition-colors"
            >
              Run: {STAGE_LABELS[stage]}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Status */}
        {agents.length > 0 && <AgentStatusGrid agents={agents} />}

        {/* Economic System */}
        {economic && <EconomicSystemPanel balance={economic} />}

        {/* Bounty List */}
        <BountyProgressList bounties={bounties} />

        {/* Relay Messages */}
        <RelayMessageStream messages={relayMessages} />
      </div>

      {/* Gateway Status */}
      {gateways.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🌐 Gateway Status
          </h3>
          <div className="grid grid-cols-7 gap-3">
            {gateways.map(gw => (
              <div key={gw.gw_id} className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-bold text-gray-800">GW-{gw.gw_id}</div>
                <div className="text-xs text-gray-500">:{gw.port}</div>
                <div className="mt-2 text-lg font-bold text-blue-600">{gw.active_agents}</div>
                <div className="text-xs text-gray-400">/{gw.max_concurrent}</div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${
                      gw.capacity > 0.8 ? 'bg-red-500' :
                      gw.capacity > 0.5 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${gw.capacity * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence & Anti-Hallucination Dashboard */}
      {confidence && <ConfidenceDashboard metrics={confidence} />}

      {/* Scheduler Queue */}
      {scheduler && <SchedulerQueuePanel scheduler={scheduler} />}

      {/* Disaster Recovery Status */}
      {disasterRecovery && <DisasterRecoveryPanel status={disasterRecovery} />}

      {/* WebSocket Connection Status */}
      <WebSocketStatusBar wsState={wsState} />

      {/* Event Log */}
      <EventLog events={events} />

      {/* Error Banner */}
      {mission?.error_message && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-medium">Mission Error</h4>
          <p className="text-red-600 text-sm mt-1">{mission.error_message}</p>
        </div>
      )}
    </div>
  );
}
