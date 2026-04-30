/**
 * React hook for controlling the Autonomous Bounty-Hunting Agent.
 *
 * Provides state management, event handling, and real-time status
 * updates for the bounty agent dashboard.
 *
 * @module hooks/useBountyAgent
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMissionStatus,
  startMission,
  stopMission,
  resetMission,
  runStage,
  getDiscoveredBounties,
  selectBounty,
  getAgentConfig,
  updateAgentConfig,
  getAgentEvents,
  getLastPRResult,
  type MissionStatus,
  type AgentEvent,
  type DiscoveredBounty,
  type BountyAgentConfig,
  type PRResult,
} from '../api/bounty-agent';

/** Polling interval for mission status (5 seconds). */
const STATUS_POLL_INTERVAL = 5_000;

/** Result of the useBountyAgent hook. */
export interface UseBountyAgentResult {
  /** Current mission status. */
  mission: MissionStatus | undefined;
  /** Whether the mission status is loading. */
  isMissionLoading: boolean;
  /** Error from mission status fetch. */
  missionError: Error | null;

  /** Discovered bounties with analysis. */
  bounties: DiscoveredBounty[];
  /** Whether bounties are loading. */
  isBountiesLoading: boolean;

  /** Recent agent events. */
  events: AgentEvent[];
  /** Whether events are loading. */
  isEventsLoading: boolean;

  /** Last PR submission result. */
  lastPR: PRResult | null;

  /** Agent configuration. */
  config: BountyAgentConfig | undefined;
  /** Whether config is loading. */
  isConfigLoading: boolean;

  /** Start the bounty-hunting pipeline. */
  startMission: (config?: Partial<BountyAgentConfig>) => void;
  /** Stop the current mission. */
  stopMission: () => void;
  /** Reset the orchestrator. */
  resetMission: () => void;
  /** Run a specific pipeline stage. */
  runStage: (stage: string) => void;
  /** Select a bounty for pursuit. */
  selectBounty: (bountyId: string) => void;
  /** Update agent configuration. */
  updateConfig: (config: Partial<BountyAgentConfig>) => void;

  /** Whether any mutation is in progress. */
  isMutating: boolean;
}

/**
 * Hook for controlling and monitoring the Autonomous Bounty-Hunting Agent.
 *
 * Manages the full agent lifecycle including mission control, bounty
 * discovery, event monitoring, and configuration management.
 *
 * @param options - Optional configuration for the hook.
 * @param options.enabled - Whether to enable status polling (default: true).
 * @param options.pollInterval - Status polling interval in ms (default: 5000).
 * @returns Hook result with state and control functions.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const {
 *     mission,
 *     bounties,
 *     events,
 *     startMission,
 *     stopMission,
 *   } = useBountyAgent();
 *
 *   return (
 *     <div>
 *       <p>Status: {mission?.currentStage}</p>
 *       <button onClick={() => startMission()}>Start</button>
 *       <button onClick={() => stopMission()}>Stop</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useBountyAgent(options?: {
  enabled?: boolean;
  pollInterval?: number;
}): UseBountyAgentResult {
  const queryClient = useQueryClient();
  const enabled = options?.enabled ?? true;
  const pollInterval = options?.pollInterval ?? STATUS_POLL_INTERVAL;

  // Mission status (polled)
  const {
    data: mission,
    isLoading: isMissionLoading,
    error: missionError,
  } = useQuery({
    queryKey: ['agent-mission'],
    queryFn: getMissionStatus,
    refetchInterval: enabled ? pollInterval : false,
    staleTime: 0, // Always consider stale for real-time updates
  });

  // Discovered bounties
  const {
    data: bounties,
    isLoading: isBountiesLoading,
  } = useQuery({
    queryKey: ['agent-bounties'],
    queryFn: getDiscoveredBounties,
    enabled,
  });

  // Agent events
  const {
    data: events,
    isLoading: isEventsLoading,
  } = useQuery({
    queryKey: ['agent-events'],
    queryFn: () => getAgentEvents(50),
    refetchInterval: enabled ? 3_000 : false,
    staleTime: 0,
  });

  // Last PR result
  const { data: lastPR } = useQuery({
    queryKey: ['agent-pr-result'],
    queryFn: getLastPRResult,
    enabled,
  });

  // Agent config
  const {
    data: config,
    isLoading: isConfigLoading,
  } = useQuery({
    queryKey: ['agent-config'],
    queryFn: getAgentConfig,
  });

  // Mutation for starting mission
  const startMissionMutation = useMutation({
    mutationFn: startMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-mission'] });
      queryClient.invalidateQueries({ queryKey: ['agent-events'] });
    },
  });

  // Mutation for stopping mission
  const stopMissionMutation = useMutation({
    mutationFn: stopMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-mission'] });
      queryClient.invalidateQueries({ queryKey: ['agent-events'] });
    },
  });

  // Mutation for resetting mission
  const resetMissionMutation = useMutation({
    mutationFn: resetMission,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-mission'] });
      queryClient.invalidateQueries({ queryKey: ['agent-events'] });
      queryClient.invalidateQueries({ queryKey: ['agent-bounties'] });
    },
  });

  // Mutation for running a stage
  const runStageMutation = useMutation({
    mutationFn: runStage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-mission'] });
      queryClient.invalidateQueries({ queryKey: ['agent-events'] });
      queryClient.invalidateQueries({ queryKey: ['agent-bounties'] });
      queryClient.invalidateQueries({ queryKey: ['agent-pr-result'] });
    },
  });

  // Mutation for selecting a bounty
  const selectBountyMutation = useMutation({
    mutationFn: selectBounty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-mission'] });
      queryClient.invalidateQueries({ queryKey: ['agent-events'] });
    },
  });

  // Mutation for updating config
  const updateConfigMutation = useMutation({
    mutationFn: updateAgentConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-config'] });
    },
  });

  // Callback wrappers
  const startMissionCb = useCallback(
    (cfg?: Partial<BountyAgentConfig>) => {
      startMissionMutation.mutate(cfg ?? {});
    },
    [startMissionMutation],
  );

  const stopMissionCb = useCallback(() => {
    stopMissionMutation.mutate();
  }, [stopMissionMutation]);

  const resetMissionCb = useCallback(() => {
    resetMissionMutation.mutate();
  }, [resetMissionMutation]);

  const runStageCb = useCallback(
    (stage: string) => {
      runStageMutation.mutate(stage);
    },
    [runStageMutation],
  );

  const selectBountyCb = useCallback(
    (bountyId: string) => {
      selectBountyMutation.mutate(bountyId);
    },
    [selectBountyMutation],
  );

  const updateConfigCb = useCallback(
    (cfg: Partial<BountyAgentConfig>) => {
      updateConfigMutation.mutate(cfg);
    },
    [updateConfigMutation],
  );

  // Whether any mutation is in progress
  const isMutating =
    startMissionMutation.isPending ||
    stopMissionMutation.isPending ||
    resetMissionMutation.isPending ||
    runStageMutation.isPending ||
    selectBountyMutation.isPending ||
    updateConfigMutation.isPending;

  return {
    mission,
    isMissionLoading,
    missionError: missionError as Error | null,
    bounties: bounties ?? [],
    isBountiesLoading,
    events: events ?? [],
    isEventsLoading,
    lastPR: lastPR ?? null,
    config,
    isConfigLoading,
    startMission: startMissionCb,
    stopMission: stopMissionCb,
    resetMission: resetMissionCb,
    runStage: runStageCb,
    selectBounty: selectBountyCb,
    updateConfig: updateConfigCb,
    isMutating,
  };
}

/**
 * Stage progress information for the pipeline visualization.
 */
export interface StageProgress {
  /** Stage name. */
  stage: string;
  /** Display label. */
  label: string;
  /** Current status. */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** Progress percentage (0-100). */
  progress: number;
}

/**
 * Derive stage progress from mission state.
 *
 * @param mission - Current mission status.
 * @returns Array of stage progress objects.
 */
export function useStageProgress(mission?: MissionStatus): StageProgress[] {
  const stages: StageProgress[] = [
    { stage: 'discover', label: 'Discover', status: 'pending', progress: 0 },
    { stage: 'analyze', label: 'Analyze', status: 'pending', progress: 0 },
    { stage: 'implement', label: 'Implement', status: 'pending', progress: 0 },
    { stage: 'test', label: 'Test', status: 'pending', progress: 0 },
    { stage: 'submit', label: 'Submit', status: 'pending', progress: 0 },
  ];

  if (!mission) return stages;

  const currentStage = mission.currentStage.toLowerCase();
  const stageOrder = ['discover', 'analyze', 'implement', 'test', 'submit'];
  const currentIndex = stageOrder.indexOf(currentStage);

  // Mark completed stages
  for (let i = 0; i < stageOrder.length; i++) {
    if (i < currentIndex) {
      stages[i].status = 'completed';
      stages[i].progress = 100;
    } else if (i === currentIndex) {
      if (mission.isFailed) {
        stages[i].status = 'failed';
        stages[i].progress = 0;
      } else if (mission.isComplete) {
        stages[i].status = 'completed';
        stages[i].progress = 100;
      } else {
        stages[i].status = 'running';
        stages[i].progress = 50;
      }
    }
  }

  return stages;
}
