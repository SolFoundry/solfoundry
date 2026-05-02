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

// ---------------------------------------------------------------------------
// WebSocket Connection Hook
// ---------------------------------------------------------------------------

export interface WSMessage {
  type: 'agent_status' | 'mission_update' | 'relay_message' | 'event' | 'economic_update' | 'scheduler_update';
  payload: unknown;
  timestamp: string;
}

export interface WSConnectionState {
  isConnected: boolean;
  reconnectCount: number;
  lastMessageAt: string | null;
  latency: number;
}

/**
 * WebSocket connection for real-time updates.
 * Auto-reconnects with exponential backoff on disconnect.
 */
export function useBountyAgentWebSocket(url?: string) {
  const queryClient = useQueryClient();
  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectCountRef = React.useRef(0);
  const reconnectTimerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const [connectionState, setConnectionState] = React.useState<WSConnectionState>({
    isConnected: false,
    reconnectCount: 0,
    lastMessageAt: null,
    latency: 0,
  });

  const connect = React.useCallback(() => {
    const wsUrl = url || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${API_BASE}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectTime = Date.now();

      ws.onopen = () => {
        const latency = Date.now() - connectTime;
        setConnectionState(prev => ({
          ...prev,
          isConnected: true,
          latency,
          reconnectCount: reconnectCountRef.current,
        }));
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          setConnectionState(prev => ({
            ...prev,
            lastMessageAt: new Date().toISOString(),
          }));

          // Route messages to appropriate query cache invalidations
          switch (msg.type) {
            case 'agent_status':
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.agents() });
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.team() });
              break;
            case 'mission_update':
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.mission() });
              break;
            case 'relay_message':
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.relay() });
              break;
            case 'event':
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.events() });
              break;
            case 'economic_update':
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.economics() });
              break;
            case 'scheduler_update':
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.agents() });
              queryClient.invalidateQueries({ queryKey: bountyAgentKeys.team() });
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnectionState(prev => ({ ...prev, isConnected: false }));
        // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
        const delay = Math.min(1000 * Math.pow(2, reconnectCountRef.current), 30000);
        reconnectCountRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not available, fall back to polling
      setConnectionState(prev => ({ ...prev, isConnected: false }));
    }
  }, [url, queryClient]);

  React.useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  /** Send a message through the WebSocket */
  const send = React.useCallback((msg: Partial<WSMessage>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...msg,
        timestamp: new Date().toISOString(),
      }));
    }
  }, []);

  return {
    ...connectionState,
    send,
    wsRef,
  };
}

// ---------------------------------------------------------------------------
// Scheduler & Confidence Hooks
// ---------------------------------------------------------------------------

export interface ScheduleEntry {
  agent_id: string;
  department: string;
  task: string;
  priority: number;
  scheduled_at: string;
  estimated_duration_ms: number;
}

export interface SchedulerStatus {
  queue_length: number;
  active_tasks: number;
  completed_today: number;
  avg_wait_time_ms: number;
  peak_concurrent: number;
  current_concurrent: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  agent_ratings: Record<string, { grade: string; score: number; tasks_completed: number }>;
  queue: ScheduleEntry[];
}

/** Fetch scheduler status with queue visualization data */
export function useSchedulerStatus() {
  return useQuery({
    queryKey: [...bountyAgentKeys.all, 'scheduler'] as const,
    queryFn: () => fetchJSON<SchedulerStatus>(`${API_BASE}/scheduler`),
    refetchInterval: 5000,
  });
}

export interface ConfidenceMetrics {
  overall_confidence: number;
  discovery_confidence: number;
  analysis_confidence: number;
  implementation_confidence: number;
  submission_confidence: number;
  anti_hallucination_score: number;
  cross_review_agreement: number;
  model_consensus: number;
}

/** Fetch confidence and anti-hallucination metrics */
export function useConfidenceMetrics() {
  return useQuery({
    queryKey: [...bountyAgentKeys.all, 'confidence'] as const,
    queryFn: () => fetchJSON<ConfidenceMetrics>(`${API_BASE}/confidence`),
    refetchInterval: 10000,
  });
}

// ---------------------------------------------------------------------------
// Agent Configuration Hook
// ---------------------------------------------------------------------------

export interface AgentConfig {
  auto_select_bounty: boolean;
  min_reward_amount: number;
  max_effort_hours: number;
  agent_skills: string[];
  target_repo: string;
  anti_hallucination_enabled: boolean;
  cross_review_required: boolean;
  min_reviewers: number;
  max_concurrent_tasks: number;
  memory_limit_mb: number;
  scheduling_strategy: 'round_robin' | 'priority' | 'capacity';
}

/** Fetch and update agent configuration */
export function useAgentConfig() {
  return useQuery({
    queryKey: [...bountyAgentKeys.all, 'config'] as const,
    queryFn: () => fetchJSON<AgentConfig>(`${API_BASE}/config`),
  });
}

export function useUpdateAgentConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Partial<AgentConfig>) => postJSON(`${API_BASE}/config`, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...bountyAgentKeys.all, 'config'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Disaster Recovery Hook
// ---------------------------------------------------------------------------

export interface DisasterRecoveryStatus {
  checkpoint_enabled: boolean;
  last_checkpoint_at: string | null;
  checkpoint_interval_s: number;
  recovery_count: number;
  data_layer_status: 'healthy' | 'degraded' | 'failed';
  app_layer_status: 'healthy' | 'degraded' | 'failed';
  business_layer_status: 'healthy' | 'degraded' | 'failed';
  backup_status: '3-2-1-compliant' | 'degraded' | 'at-risk';
}

/** Fetch disaster recovery status */
export function useDisasterRecovery() {
  return useQuery({
    queryKey: [...bountyAgentKeys.all, 'disaster-recovery'] as const,
    queryFn: () => fetchJSON<DisasterRecoveryStatus>(`${API_BASE}/disaster-recovery`),
    refetchInterval: 30000,
  });
}
