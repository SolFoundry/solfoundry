/**
 * Tests for the BountyAgentDashboard component and useBountyAgent hook.
 *
 * Verifies that the dashboard renders correctly, handles different
 * mission states, and provides proper controls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import BountyAgentDashboard from '../components/BountyAgentDashboard';
import { useBountyAgent, useStageProgress } from '../hooks/useBountyAgent';
import type {
  MissionStatus,
  AgentEvent,
  DiscoveredBounty,
} from '../api/bounty-agent';

// ---------------------------------------------------------------------------
// Mock the API module
// ---------------------------------------------------------------------------

vi.mock('../api/bounty-agent', () => ({
  getMissionStatus: vi.fn(),
  startMission: vi.fn(),
  stopMission: vi.fn(),
  resetMission: vi.fn(),
  runStage: vi.fn(),
  getDiscoveredBounties: vi.fn(),
  selectBounty: vi.fn(),
  getAgentConfig: vi.fn(),
  updateAgentConfig: vi.fn(),
  getAgentEvents: vi.fn(),
  getLastPRResult: vi.fn(),
}));

// Import mocked functions
import * as bountyAgentApi from '../api/bounty-agent';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createMockMission(overrides?: Partial<MissionStatus>): MissionStatus {
  return {
    missionId: 'mission-001',
    bountyId: null,
    currentStage: 'discover',
    agentStates: {
      planner: 'idle',
      coder: 'idle',
      tester: 'idle',
      submitter: 'idle',
      orchestrator: 'idle',
    },
    isActive: false,
    isComplete: false,
    isFailed: false,
    errorMessage: null,
    createdAt: '2026-04-30T00:00:00Z',
    updatedAt: '2026-04-30T00:00:00Z',
    completedAt: null,
    stageResults: {},
    ...overrides,
  };
}

function createMockBounty(overrides?: Partial<DiscoveredBounty>): DiscoveredBounty {
  return {
    bountyId: 'bounty-001',
    title: 'Implement Search API',
    skillMatchScore: 0.8,
    estimatedDifficulty: 5,
    estimatedEffortHours: 16,
    rewardAmount: 500,
    valueRatio: 31.25,
    shouldPursue: true,
    confidence: 0.85,
    ...overrides,
  };
}

function createMockEvent(overrides?: Partial<AgentEvent>): AgentEvent {
  return {
    type: 'status_update',
    timestamp: '2026-04-30T00:00:00Z',
    agent: 'orchestrator',
    message: 'Test event',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test wrapper
// ---------------------------------------------------------------------------

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
}

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Dashboard Component Tests
// ---------------------------------------------------------------------------

describe('BountyAgentDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (bountyAgentApi.getMissionStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockMission(),
    );
    (bountyAgentApi.getDiscoveredBounties as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (bountyAgentApi.getAgentEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (bountyAgentApi.getAgentConfig as ReturnType<typeof vi.fn>).mockResolvedValue({
      autoSelectBounty: true,
      minRewardAmount: 100,
      maxEffortHours: 40,
      agentSkills: ['typescript'],
      targetRepo: 'SolFoundry/solfoundry',
    });
    (bountyAgentApi.getLastPRResult as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  it('should render the dashboard header', async () => {
    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Bounty Agent Dashboard')).toBeInTheDocument();
    });
  });

  it('should show mission control buttons', async () => {
    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Start Mission')).toBeInTheDocument();
      expect(screen.getByText('Stop Mission')).toBeInTheDocument();
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });
  });

  it('should show pipeline progress section', async () => {
    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Pipeline Progress')).toBeInTheDocument();
    });
  });

  it('should show stage buttons', async () => {
    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Discover')).toBeInTheDocument();
      expect(screen.getByText('Analyze')).toBeInTheDocument();
      expect(screen.getByText('Implement')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Submit')).toBeInTheDocument();
    });
  });

  it('should show discovered bounties section', async () => {
    const bounties = [
      createMockBounty({ bountyId: 'bounty-1', title: 'Search API', rewardAmount: 500 }),
      createMockBounty({ bountyId: 'bounty-2', title: 'Dashboard UI', rewardAmount: 400 }),
    ];
    (bountyAgentApi.getDiscoveredBounties as ReturnType<typeof vi.fn>).mockResolvedValue(bounties);

    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Discovered Bounties')).toBeInTheDocument();
      expect(screen.getByText('Search API')).toBeInTheDocument();
      expect(screen.getByText('Dashboard UI')).toBeInTheDocument();
    });
  });

  it('should show event log section', async () => {
    const events = [
      createMockEvent({ type: 'agent_started', message: 'Agent started', agent: 'planner' }),
      createMockEvent({ type: 'status_update', message: 'Status update', agent: 'orchestrator' }),
    ];
    (bountyAgentApi.getAgentEvents as ReturnType<typeof vi.fn>).mockResolvedValue(events);

    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Event Log')).toBeInTheDocument();
    });
  });

  it('should show mission details when mission exists', async () => {
    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Mission Details')).toBeInTheDocument();
      expect(screen.getByText('mission-001')).toBeInTheDocument();
    });
  });

  it('should show "no bounties" message when empty', async () => {
    (bountyAgentApi.getDiscoveredBounties as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/No bounties discovered yet/),
      ).toBeInTheDocument();
    });
  });

  it('should show active mission status when mission is active', async () => {
    (bountyAgentApi.getMissionStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockMission({
        isActive: true,
        currentStage: 'implement',
        bountyId: 'bounty-001',
      }),
    );

    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('running')).toBeInTheDocument();
    });
  });

  it('should show completed mission status', async () => {
    (bountyAgentApi.getMissionStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockMission({
        isActive: false,
        isComplete: true,
        currentStage: 'monitor',
      }),
    );

    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeInTheDocument();
    });
  });

  it('should show failed mission status with error', async () => {
    (bountyAgentApi.getMissionStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      createMockMission({
        isActive: false,
        isFailed: true,
        errorMessage: 'Test error message',
      }),
    );

    renderWithQueryClient(<BountyAgentDashboard />);

    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// useStageProgress Hook Tests
// ---------------------------------------------------------------------------

describe('useStageProgress', () => {
  it('should return pending stages when no mission', () => {
    const stages = useStageProgress(undefined);

    expect(stages).toHaveLength(5);
    for (const stage of stages) {
      expect(stage.status).toBe('pending');
      expect(stage.progress).toBe(0);
    }
  });

  it('should mark stages as running based on current stage', () => {
    const mission = createMockMission({
      currentStage: 'implement',
      isActive: true,
    });

    const stages = useStageProgress(mission);

    expect(stages[0].status).toBe('completed'); // discover
    expect(stages[1].status).toBe('completed'); // analyze
    expect(stages[2].status).toBe('running'); // implement
    expect(stages[3].status).toBe('pending'); // test
    expect(stages[4].status).toBe('pending'); // submit
  });

  it('should mark all stages as completed when mission is complete', () => {
    const mission = createMockMission({
      currentStage: 'submit',
      isComplete: true,
    });

    const stages = useStageProgress(mission);

    for (const stage of stages) {
      expect(stage.status).toBe('completed');
      expect(stage.progress).toBe(100);
    }
  });

  it('should mark current stage as failed when mission fails', () => {
    const mission = createMockMission({
      currentStage: 'test',
      isFailed: true,
    });

    const stages = useStageProgress(mission);

    expect(stages[0].status).toBe('completed'); // discover
    expect(stages[1].status).toBe('completed'); // analyze
    expect(stages[2].status).toBe('completed'); // implement
    expect(stages[3].status).toBe('failed'); // test
    expect(stages[4].status).toBe('pending'); // submit
  });
});
