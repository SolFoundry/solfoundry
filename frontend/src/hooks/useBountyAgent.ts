import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types — shared with BountyAgentDashboard
// ---------------------------------------------------------------------------

export interface MissionStatus {
  mission_id: string | null;
  bounty_id: string | null;
  current_stage: 'idle' | 'discover' | 'analyze' | 'implement' | 'submit' | 'complete' | 'failed';
  is_active: boolean;
  is_complete: boolean;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentNode {
  agent_id: string;
  department: string;
  model: string;
  gateway: number;
  status: 'idle' | 'busy' | 'error';
  tasks_completed: number;
}

export interface GatewayStatus {
  gw_id: number;
  port: number;
  active_agents: number;
  max_concurrent: number;
  capacity: number;
}

export interface DiscoveredBounty {
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

export interface EconomicBalance {
  claw_tasks_earned: number;
  agent_token_balance: number;
  moltspay_pending: number;
  moltspay_settled: number;
  total_usd_equivalent: number;
}

export interface RelayMessage {
  id: string;
  from_agent: string;
  to_agent: string;
  message_type: 'task_assign' | 'review_request' | 'escalation' | 'status_update';
  content: string;
  timestamp: string;
  hop_count: number;
}

export interface AgentEvent {
  type: string;
  timestamp: string;
  agent: string;
  department: string;
  message: string;
}

export interface TeamStatus {
  total_agents: number;
  gateways: number;
  idle: number;
  busy: number;
  error: number;
  total_completed: number;
}

// ---------------------------------------------------------------------------
// API Base URL
// ---------------------------------------------------------------------------

const API_BASE = '/api/bounty-agent';

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const bountyAgentKeys = {
  all: ['bounty-agent'] as const,
  mission: () => [...bountyAgentKeys.all, 'mission'] as const,
  team: () => [...bountyAgentKeys.all, 'team'] as const,
  agents: () => [...bountyAgentKeys.all, 'agents'] as const,
  gateways: () => [...bountyAgentKeys.all, 'gateways'] as const,
  bounties: () => [...bountyAgentKeys.all, 'bounties'] as const,
  economics: () => [...bountyAgentKeys.all, 'economics'] as const,
  relay: () => [...bountyAgentKeys.all, 'relay'] as const,
  events: () => [...bountyAgentKeys.all, 'events'] as const,
};

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }
  return res.json();
}

async function postJSON(url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

/** Fetch current mission status (auto-refreshes every 5s) */
export function useMissionStatus() {
  return useQuery({
    queryKey: bountyAgentKeys.mission(),
    queryFn: () => fetchJSON<MissionStatus>(`${API_BASE}/mission`),
    refetchInterval: 5000,
  });
}

/** Fetch team status overview (auto-refreshes every 5s) */
export function useTeamStatus() {
  return useQuery({
    queryKey: bountyAgentKeys.team(),
    queryFn: () => fetchJSON<TeamStatus>(`${API_BASE}/team`),
    refetchInterval: 5000,
  });
}

/** Fetch all 51 agent nodes (auto-refreshes every 10s) */
export function useAgents() {
  return useQuery({
    queryKey: bountyAgentKeys.agents(),
    queryFn: () => fetchJSON<AgentNode[]>(`${API_BASE}/agents`),
    refetchInterval: 10000,
  });
}

/** Fetch gateway status (auto-refreshes every 10s) */
export function useGateways() {
  return useQuery({
    queryKey: bountyAgentKeys.gateways(),
    queryFn: () => fetchJSON<GatewayStatus[]>(`${API_BASE}/gateways`),
    refetchInterval: 10000,
  });
}

/** Fetch discovered bounties (auto-refreshes every 30s) */
export function useDiscoveredBounties() {
  return useQuery({
    queryKey: bountyAgentKeys.bounties(),
    queryFn: () => fetchJSON<DiscoveredBounty[]>(`${API_BASE}/bounties`),
    refetchInterval: 30000,
  });
}

/** Fetch economic system balance (auto-refreshes every 15s) */
export function useEconomicBalance() {
  return useQuery({
    queryKey: bountyAgentKeys.economics(),
    queryFn: () => fetchJSON<EconomicBalance>(`${API_BASE}/economics`),
    refetchInterval: 15000,
  });
}

/** Fetch relay messages (auto-refreshes every 5s) */
export function useRelayMessages() {
  return useQuery({
    queryKey: bountyAgentKeys.relay(),
    queryFn: () => fetchJSON<RelayMessage[]>(`${API_BASE}/relay?limit=20`),
    refetchInterval: 5000,
  });
}

/** Fetch agent events (auto-refreshes every 5s) */
export function useAgentEvents() {
  return useQuery({
    queryKey: bountyAgentKeys.events(),
    queryFn: () => fetchJSON<AgentEvent[]>(`${API_BASE}/events?limit=50`),
    refetchInterval: 5000,
  });
}

// ---------------------------------------------------------------------------
// Stage Progress Hook
// ---------------------------------------------------------------------------

const STAGE_ORDER = ['discover', 'analyze', 'implement', 'submit'] as const;

/** Compute pipeline progress percentage based on current stage */
export function useStageProgress() {
  const mission = useMissionStatus();

  const progress = (() => {
    if (!mission.data) return 0;
    const { current_stage, is_complete } = mission.data;
    if (is_complete) return 100;
    const idx = STAGE_ORDER.indexOf(current_stage as typeof STAGE_ORDER[number]);
    if (idx === -1) return current_stage === 'idle' ? 0 : 0;
    return Math.round(((idx) / STAGE_ORDER.length) * 100);
  })();

  return {
    progress,
    currentStage: mission.data?.current_stage ?? 'idle',
    isComplete: mission.data?.is_complete ?? false,
    isFailed: mission.data?.current_stage === 'failed',
    isLoading: mission.isLoading,
  };
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

/** Start a new autonomous bounty-hunting mission */
export function useStartMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJSON(`${API_BASE}/mission/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.mission() });
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.team() });
    },
  });
}

/** Stop the current mission */
export function useStopMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJSON(`${API_BASE}/mission/stop`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.mission() });
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.team() });
    },
  });
}

/** Reset mission state */
export function useResetMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postJSON(`${API_BASE}/mission/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.all });
    },
  });
}

/** Execute a specific pipeline stage */
export function useRunStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stage: string) => postJSON(`${API_BASE}/mission/stage`, { stage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.mission() });
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.team() });
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.events() });
    },
  });
}

/** Select a discovered bounty for execution */
export function useSelectBounty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bountyId: string) => postJSON(`${API_BASE}/bounties/select`, { bounty_id: bountyId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bountyAgentKeys.mission() });
    },
  });
}
