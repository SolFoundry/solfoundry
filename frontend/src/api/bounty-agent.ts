/**
 * API client for the Autonomous Bounty Agent system.
 *
 * Provides typed functions for all agent endpoints:
 * - Mission control (start, stop, reset)
 * - Bounty discovery and scanning
 * - Scheduler management
 * - Economic system queries
 * - LLM provider status
 * - Disaster recovery operations
 *
 * @module api/bounty-agent
 * @author Xeophon
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MissionStartPayload {
  bounty_id?: string;
  platform?: string;
  auto_discover?: boolean;
  max_bounties?: number;
}

export interface MissionStatus {
  mission_id: string | null;
  bounty_id: string | null;
  current_stage: MissionStage;
  is_active: boolean;
  is_complete: boolean;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  stages_completed: string[];
}

export type MissionStage =
  | 'idle'
  | 'discover'
  | 'analyze'
  | 'plan'
  | 'implement'
  | 'test'
  | 'submit'
  | 'complete'
  | 'failed';

export interface DiscoveredBounty {
  bounty_id: string;
  title: string;
  platform: string;
  reward: string;
  reward_amount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'unknown';
  skill_match_score: number;
  estimated_effort_hours: number;
  url: string;
  is_easy: boolean;
}

export interface AgentNode {
  agent_id: string;
  department: string;
  model: string;
  gateway: number;
  tier: 'S' | 'A' | 'B' | 'C';
  status: 'idle' | 'busy' | 'error' | 'offline' | 'draining';
  tasks_completed: number;
  tasks_failed: number;
  memory_usage_mb: number;
  memory_limit_mb: number;
  reliability_score: number;
}

export interface GatewayStatus {
  gw_id: number;
  port: number;
  host: string;
  active_agents: number;
  max_concurrent: number;
  total_memory_mb: number;
  memory_limit_mb: number;
  capacity_percent: number;
}

export interface SchedulerStatus {
  total_agents: number;
  available_agents: number;
  queued_tasks: number;
  tier_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  total_memory_mb: number;
  memory_usage_percent: number;
}

export interface EconomicBalance {
  claw_tasks_earned: number;
  agent_token_balance: number;
  moltspay_pending: number;
  moltspay_confirmed: number;
  team_wallet: string;
}

export interface RelayMessage {
  link_id: string;
  source_agent_id: string;
  target_agent_id: string;
  content: string;
  mode: 'native' | 'feishu';
  hop_count: number;
  timestamp: number;
}

export interface LLMProviderStatus {
  provider_key: string;
  model: string;
  provider_type: string;
  rate_limit_rpm: number;
  requests_remaining: number;
  tokens_remaining: number;
  is_healthy: boolean;
}

export interface ConfidenceMetrics {
  source_verification_rate: number;
  avg_confidence_score: number;
  hallucination_rejections: number;
  human_review_pending: number;
  fact_check_pass_rate: number;
}

export interface DisasterRecoveryStatus {
  gateway_failovers: number;
  checkpoint_recoveries: number;
  dead_letter_count: number;
  last_failover_at: string | null;
  health_status: 'healthy' | 'degraded' | 'critical';
}

export interface EventLogEntry {
  event_id: string;
  event_type: string;
  agent_id: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Mission Control API
// ---------------------------------------------------------------------------

export async function startMission(
  payload: MissionStartPayload = {}
): Promise<MissionStatus> {
  const { data } = await apiClient.post<MissionStatus>(
    '/api/bounty-agent/mission/start',
    payload
  );
  return data;
}

export async function stopMission(missionId: string): Promise<MissionStatus> {
  const { data } = await apiClient.post<MissionStatus>(
    `/api/bounty-agent/mission/${missionId}/stop`
  );
  return data;
}

export async function resetMission(missionId: string): Promise<MissionStatus> {
  const { data } = await apiClient.post<MissionStatus>(
    `/api/bounty-agent/mission/${missionId}/reset`
  );
  return data;
}

export async function getMissionStatus(
  missionId?: string
): Promise<MissionStatus> {
  const url = missionId
    ? `/api/bounty-agent/mission/${missionId}`
    : '/api/bounty-agent/mission/current';
  const { data } = await apiClient.get<MissionStatus>(url);
  return data;
}

// ---------------------------------------------------------------------------
// Discovery API
// ---------------------------------------------------------------------------

export async function scanBounties(
  platform?: string,
  maxResults: number = 20
): Promise<DiscoveredBounty[]> {
  const { data } = await apiClient.get<DiscoveredBounty[]>(
    '/api/bounty-agent/discover',
    { params: { platform, max_results: maxResults } }
  );
  return data;
}

export async function getDiscoveredBounties(): Promise<DiscoveredBounty[]> {
  const { data } = await apiClient.get<DiscoveredBounty[]>(
    '/api/bounty-agent/bounties'
  );
  return data;
}

export async function analyzeCompetition(
  bountyId: string
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post(
    `/api/bounty-agent/bounties/${bountyId}/analyze-competition`
  );
  return data;
}

// ---------------------------------------------------------------------------
// Scheduler API
// ---------------------------------------------------------------------------

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const { data } = await apiClient.get<SchedulerStatus>(
    '/api/bounty-agent/scheduler/status'
  );
  return data;
}

export async function getAgentNodes(): Promise<AgentNode[]> {
  const { data } = await apiClient.get<AgentNode[]>(
    '/api/bounty-agent/scheduler/agents'
  );
  return data;
}

export async function getGatewayStatuses(): Promise<GatewayStatus[]> {
  const { data } = await apiClient.get<GatewayStatus[]>(
    '/api/bounty-agent/scheduler/gateways'
  );
  return data;
}

export async function updateAgentHeartbeat(
  agentId: string,
  memoryMb: number
): Promise<void> {
  await apiClient.post(`/api/bounty-agent/scheduler/agents/${agentId}/heartbeat`, {
    memory_mb: memoryMb,
  });
}

// ---------------------------------------------------------------------------
// Economic System API
// ---------------------------------------------------------------------------

export async function getEconomicBalance(): Promise<EconomicBalance> {
  const { data } = await apiClient.get<EconomicBalance>(
    '/api/bounty-agent/economic/balance'
  );
  return data;
}

export async function getRelayMessages(
  limit: number = 50
): Promise<RelayMessage[]> {
  const { data } = await apiClient.get<RelayMessage[]>(
    '/api/bounty-agent/relay/messages',
    { params: { limit } }
  );
  return data;
}

// ---------------------------------------------------------------------------
// LLM & Confidence API
// ---------------------------------------------------------------------------

export async function getLLMProviders(): Promise<LLMProviderStatus[]> {
  const { data } = await apiClient.get<LLMProviderStatus[]>(
    '/api/bounty-agent/llm/providers'
  );
  return data;
}

export async function getConfidenceMetrics(): Promise<ConfidenceMetrics> {
  const { data } = await apiClient.get<ConfidenceMetrics>(
    '/api/bounty-agent/confidence'
  );
  return data;
}

// ---------------------------------------------------------------------------
// Disaster Recovery API
// ---------------------------------------------------------------------------

export async function getDisasterRecoveryStatus(): Promise<DisasterRecoveryStatus> {
  const { data } = await apiClient.get<DisasterRecoveryStatus>(
    '/api/bounty-agent/disaster-recovery'
  );
  return data;
}

export async function triggerFailover(
  fromGateway: number,
  toGateway: number
): Promise<void> {
  await apiClient.post('/api/bounty-agent/disaster-recovery/failover', {
    from_gateway: fromGateway,
    to_gateway: toGateway,
  });
}

// ---------------------------------------------------------------------------
// Event Log API
// ---------------------------------------------------------------------------

export async function getEventLog(
  limit: number = 100,
  since?: string
): Promise<EventLogEntry[]> {
  const { data } = await apiClient.get<EventLogEntry[]>(
    '/api/bounty-agent/events',
    { params: { limit, since } }
  );
  return data;
}
