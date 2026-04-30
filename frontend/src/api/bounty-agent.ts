/**
 * API endpoints for the Autonomous Bounty-Hunting Agent system.
 *
 * Provides functions for controlling the agent pipeline,
 * monitoring status, and retrieving results.
 *
 * @module api/bounty-agent
 */

import { apiClient } from '../services/apiClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for the bounty agent. */
export interface BountyAgentConfig {
  /** Whether auto-select is enabled. */
  autoSelectBounty: boolean;
  /** Minimum reward amount. */
  minRewardAmount: number;
  /** Maximum effort hours. */
  maxEffortHours: number;
  /** Agent skills. */
  agentSkills: string[];
  /** Target repository. */
  targetRepo: string;
}

/** Agent state information. */
export interface AgentStatus {
  /** Agent role. */
  role: string;
  /** Current state. */
  state: string;
  /** Current task description. */
  currentTask: string | null;
  /** When the agent started its current task. */
  startedAt: string | null;
}

/** Mission state for the orchestrator. */
export interface MissionStatus {
  /** Unique mission ID. */
  missionId: string;
  /** Current bounty ID being worked on. */
  bountyId: string | null;
  /** Current pipeline stage. */
  currentStage: string;
  /** States of all agents. */
  agentStates: Record<string, string>;
  /** Whether the mission is active. */
  isActive: boolean;
  /** Whether the mission completed successfully. */
  isComplete: boolean;
  /** Whether the mission failed. */
  isFailed: boolean;
  /** Error message if failed. */
  errorMessage: string | null;
  /** When the mission was created. */
  createdAt: string;
  /** When the mission was last updated. */
  updatedAt: string;
  /** When the mission completed (if applicable). */
  completedAt: string | null;
  /** Results from each stage. */
  stageResults: Record<string, unknown>;
}

/** Event emitted by the agent system. */
export interface AgentEvent {
  /** Event type. */
  type: string;
  /** Timestamp. */
  timestamp: string;
  /** Agent role. */
  agent: string;
  /** Event message. */
  message: string;
  /** Optional event data. */
  data?: Record<string, unknown>;
}

/** Discovered bounty with analysis. */
export interface DiscoveredBounty {
  /** Bounty ID. */
  bountyId: string;
  /** Bounty title. */
  title: string;
  /** Skill match score (0-1). */
  skillMatchScore: number;
  /** Estimated difficulty (1-10). */
  estimatedDifficulty: number;
  /** Estimated effort in hours. */
  estimatedEffortHours: number;
  /** Reward amount. */
  rewardAmount: number;
  /** Value-to-effort ratio. */
  valueRatio: number;
  /** Whether the bounty should be pursued. */
  shouldPursue: boolean;
  /** Analysis confidence (0-1). */
  confidence: number;
}

/** PR submission result. */
export interface PRResult {
  /** Whether the PR was successfully created. */
  success: boolean;
  /** PR URL. */
  prUrl: string | null;
  /** PR number. */
  prNumber: number | null;
  /** Branch name. */
  branchName: string;
  /** PR title. */
  prTitle: string;
  /** Error message if failed. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Get the current mission status.
 *
 * @returns The current mission state.
 */
export async function getMissionStatus(): Promise<MissionStatus> {
  return apiClient<MissionStatus>('/api/agent/mission');
}

/**
 * Start the bounty-hunting pipeline.
 *
 * @param config - Optional configuration overrides.
 * @returns The updated mission status.
 */
export async function startMission(config?: Partial<BountyAgentConfig>): Promise<MissionStatus> {
  return apiClient<MissionStatus>('/api/agent/start', {
    method: 'POST',
    body: config,
  });
}

/**
 * Stop the current mission.
 *
 * @returns The updated mission status.
 */
export async function stopMission(): Promise<MissionStatus> {
  return apiClient<MissionStatus>('/api/agent/stop', { method: 'POST' });
}

/**
 * Reset the orchestrator to initial state.
 *
 * @returns The reset mission status.
 */
export async function resetMission(): Promise<MissionStatus> {
  return apiClient<MissionStatus>('/api/agent/reset', { method: 'POST' });
}

/**
 * Run a specific pipeline stage.
 *
 * @param stage - The stage to run (discover, analyze, implement, test, submit).
 * @returns The stage result.
 */
export async function runStage(stage: string): Promise<Record<string, unknown>> {
  return apiClient<Record<string, unknown>>(`/api/agent/stage/${stage}`, { method: 'POST' });
}

/**
 * Get discovered bounties with analysis.
 *
 * @returns Array of discovered bounties with analysis.
 */
export async function getDiscoveredBounties(): Promise<DiscoveredBounty[]> {
  return apiClient<DiscoveredBounty[]>('/api/agent/bounties');
}

/**
 * Select a specific bounty for the agent to pursue.
 *
 * @param bountyId - The bounty ID to select.
 * @returns The updated mission status.
 */
export async function selectBounty(bountyId: string): Promise<MissionStatus> {
  return apiClient<MissionStatus>('/api/agent/select', {
    method: 'POST',
    body: { bountyId },
  });
}

/**
 * Get the agent's current configuration.
 *
 * @returns The current agent configuration.
 */
export async function getAgentConfig(): Promise<BountyAgentConfig> {
  return apiClient<BountyAgentConfig>('/api/agent/config');
}

/**
 * Update the agent's configuration.
 *
 * @param config - The new configuration.
 * @returns The updated configuration.
 */
export async function updateAgentConfig(config: Partial<BountyAgentConfig>): Promise<BountyAgentConfig> {
  return apiClient<BountyAgentConfig>('/api/agent/config', {
    method: 'PATCH',
    body: config,
  });
}

/**
 * Get recent agent events.
 *
 * @param limit - Maximum number of events to return.
 * @returns Array of recent events.
 */
export async function getAgentEvents(limit?: number): Promise<AgentEvent[]> {
  return apiClient<AgentEvent[]>('/api/agent/events', {
    params: limit ? { limit: String(limit) } : undefined,
  });
}

/**
 * Get the last PR submission result.
 *
 * @returns The last PR submission result.
 */
export async function getLastPRResult(): Promise<PRResult | null> {
  return apiClient<PRResult | null>('/api/agent/pr-result');
}
