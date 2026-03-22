import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PRStatusTracker, PRStatusData, PipelineStage, StageStatus } from './PRStatusTracker';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send = vi.fn();
  close = vi.fn();

  static simulateMessage(data: object) {
    MockWebSocket.instances.forEach(instance => {
      if (instance.onmessage) {
        instance.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
      }
    });
  }

  static simulateOpen() {
    MockWebSocket.instances.forEach(instance => {
      instance.readyState = 1;
      if (instance.onopen) instance.onopen(new Event('open'));
    });
  }

  static simulateError() {
    MockWebSocket.instances.forEach(instance => {
      if (instance.onerror) instance.onerror(new Event('error'));
    });
  }

  static simulateClose() {
    MockWebSocket.instances.forEach(instance => {
      instance.readyState = 0;
      if (instance.onclose) instance.onclose(new CloseEvent('close'));
    });
  }

  static clearInstances() {
    MockWebSocket.instances = [];
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

// Sample test data
const createMockStatusData = (
  currentStage: PipelineStage = 'ci_running',
  overrides?: Partial<PRStatusData>
): PRStatusData => ({
  prId: 'pr-123',
  prNumber: 123,
  prUrl: 'https://github.com/test/repo/pull/123',
  author: 'testuser',
  bountyId: 'bounty-456',
  bountyTitle: 'Test Bounty Implementation',
  stages: {
    submitted: { status: 'passed', timestamp: '2026-03-20T10:00:00Z', duration: '1s' },
    ci_running: { status: 'running', timestamp: '2026-03-20T10:01:00Z', message: 'Running tests...' },
    ai_review: { status: 'pending' },
    human_review: { status: 'pending' },
    approved: { status: 'pending' },
    denied: { status: 'pending' },
    payout: { status: 'pending' },
  },
  currentStage,
  lastUpdated: '2026-03-20T10:05:00Z',
  ...overrides,
});

const createMockStatusDataWithScores = (): PRStatusData => ({
  prId: 'pr-124',
  prNumber: 124,
  prUrl: 'https://github.com/test/repo/pull/124',
  author: 'testuser2',
  bountyId: 'bounty-457',
  bountyTitle: 'Test Bounty with AI Review',
  stages: {
    submitted: { status: 'passed', timestamp: '2026-03-20T10:00:00Z', duration: '1s' },
    ci_running: { status: 'passed', timestamp: '2026-03-20T10:05:00Z', duration: '4m 23s' },
    ai_review: {
      status: 'passed',
      timestamp: '2026-03-20T10:10:00Z',
      duration: '2m 15s',
      message: 'AI review completed successfully',
      scoreBreakdown: {
        quality: 85,
        correctness: 92,
        security: 88,
        completeness: 90,
        tests: 78,
        overall: 87,
      },
    },
    human_review: { status: 'running', timestamp: '2026-03-20T10:11:00Z' },
    approved: { status: 'pending' },
    denied: { status: 'pending' },
    payout: { status: 'pending' },
  },
  currentStage: 'human_review',
  lastUpdated: '2026-03-20T10:12:00Z',
});

const createMockApprovedData = (): PRStatusData => ({
  prId: 'pr-125',
  prNumber: 125,
  prUrl: 'https://github.com/test/repo/pull/125',
  author: 'testuser3',
  bountyId: 'bounty-458',
  bountyTitle: 'Approved Bounty',
  stages: {
    submitted: { status: 'passed', timestamp: '2026-03-20T09:00:00Z', duration: '1s' },
    ci_running: { status: 'passed', timestamp: '2026-03-20T09:05:00Z', duration: '4m' },
    ai_review: {
      status: 'passed',
      timestamp: '2026-03-20T09:10:00Z',
      duration: '2m',
      scoreBreakdown: { quality: 90, correctness: 95, security: 88, completeness: 92, tests: 85, overall: 90 },
    },
    human_review: { status: 'passed', timestamp: '2026-03-20T09:30:00Z', duration: '20m' },
    approved: { status: 'passed', timestamp: '2026-03-20T09:31:00Z', message: 'Approved by maintainer' },
    denied: { status: 'pending' },
    payout: {
      status: 'passed',
      timestamp: '2026-03-20T09:35:00Z',
      transactionHash: '5Xy8ZqW2...abc123',
      solscanUrl: 'https://solscan.io/tx/5Xy8ZqW2...abc123',
    },
  },
  currentStage: 'payout',
  lastUpdated: '2026-03-20T09:35:00Z',
});

const createMockDeniedData = (): PRStatusData => ({
  prId: 'pr-126',
  prNumber: 126,
  prUrl: 'https://github.com/test/repo/pull/126',
  author: 'testuser4',
  bountyId: 'bounty-459',
  bountyTitle: 'Denied Bounty',
  stages: {
    submitted: { status: 'passed', timestamp: '2026-03-20T09:00:00Z', duration: '1s' },
    ci_running: { status: 'passed', timestamp: '2026-03-20T09:05:00Z', duration: '4m' },
    ai_review: {
      status: 'failed',
      timestamp: '2026-03-20T09:10:00Z',
      message: 'Security issues found',
      scoreBreakdown: { quality: 70, correctness: 60, security: 45, completeness: 75, tests: 50, overall: 60 },
    },
    human_review: { status: 'passed', timestamp: '2026-03-20T09:20:00Z' },
    approved: { status: 'pending' },
    denied: { status: 'passed', timestamp: '2026-03-20T09:25:00Z', message: 'Security vulnerabilities found' },
    payout: { status: 'pending' },
  },
  currentStage: 'denied',
  lastUpdated: '2026-03-20T09:25:00Z',
});

describe('PRStatusTracker', () => {
  beforeEach(() => {
    MockWebSocket.clearInstances();
  });

  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText(/PR #123 Status/)).toBeInTheDocument();
    });

    it('displays PR number and GitHub link', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('PR #123 Status')).toBeInTheDocument();
      expect(screen.getByText('View on GitHub →')).toBeInTheDocument();
    });

    it('displays bounty title and author', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('Test Bounty Implementation')).toBeInTheDocument();
      expect(screen.getByText('by testuser')).toBeInTheDocument();
    });

    it('displays pipeline progress bar', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText(/Pipeline Progress/)).toBeInTheDocument();
      expect(screen.getByText(/stages completed/)).toBeInTheDocument();
    });

    it('hides header when showHeader is false', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} showHeader={false} />);
      expect(screen.queryByText('PR #123 Status')).not.toBeInTheDocument();
    });
  });

  // Stage Status Tests
  describe('Stage Status Display', () => {
    it('shows pending status correctly', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getAllByText('PENDING').length).toBeGreaterThan(0);
    });

    it('shows running status with animation', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      const runningBadges = screen.getAllByText('RUNNING');
      expect(runningBadges.some((el) => el.classList.contains('animate-pulse'))).toBe(true);
    });

    it('shows passed status correctly', () => {
      const mockData = createMockStatusDataWithScores();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getAllByText('PASSED').length).toBeGreaterThan(0);
    });

    it('shows failed status correctly', () => {
      const mockData = createMockDeniedData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('Security issues found')).toBeInTheDocument();
    });

    it('highlights current stage', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      const heading = screen.getByRole('heading', { name: 'CI Running' });
      const currentStageCard = heading.closest('.ring-2');
      expect(currentStageCard).toBeTruthy();
    });
  });

  // AI Score Breakdown Tests
  describe('AI Score Breakdown', () => {
    it('displays AI score breakdown when available', () => {
      const mockData = createMockStatusDataWithScores();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('AI Score Breakdown')).toBeInTheDocument();
      expect(screen.getByText('87/100')).toBeInTheDocument();
    });

    it('displays all score categories', () => {
      const mockData = createMockStatusDataWithScores();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('Quality')).toBeInTheDocument();
      expect(screen.getByText('Correctness')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Completeness')).toBeInTheDocument();
      expect(screen.getByText('Tests')).toBeInTheDocument();
    });

    it('shows correct score values', () => {
      const mockData = createMockStatusDataWithScores();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('85')).toBeInTheDocument(); // Quality
      expect(screen.getByText('92')).toBeInTheDocument(); // Correctness
      expect(screen.getByText('88')).toBeInTheDocument(); // Security
    });
  });

  // Payout Tests
  describe('Payout Display', () => {
    it('displays transaction hash for completed payout', () => {
      const mockData = createMockApprovedData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText(/Transaction/)).toBeInTheDocument();
      expect(screen.getByText('5Xy8ZqW2...abc123')).toBeInTheDocument();
    });

    it('displays Solscan link', () => {
      const mockData = createMockApprovedData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('View on Solscan')).toBeInTheDocument();
    });

    it('Solscan link has correct href', () => {
      const mockData = createMockApprovedData();
      render(<PRStatusTracker initialData={mockData} />);
      const solscanLink = screen.getByText('View on Solscan').closest('a');
      expect(solscanLink).toHaveAttribute('href', 'https://solscan.io/tx/5Xy8ZqW2...abc123');
      expect(solscanLink).toHaveAttribute('target', '_blank');
    });
  });

  // Final Status Tests
  describe('Final Status Display', () => {
    it('shows congratulations message for approved PR', () => {
      const mockData = createMockApprovedData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('🎉')).toBeInTheDocument();
      expect(screen.getByText('Congratulations! PR Approved')).toBeInTheDocument();
    });

    it('shows denial message for denied PR', () => {
      const mockData = createMockDeniedData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText('😔')).toBeInTheDocument();
      expect(screen.getByText('PR Denied')).toBeInTheDocument();
    });

    it('shows payout processing message for approved PR', () => {
      const mockData = createMockApprovedData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText(/Payout is being processed/)).toBeInTheDocument();
    });

    it('shows feedback message for denied PR', () => {
      const mockData = createMockDeniedData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByText(/review the feedback/)).toBeInTheDocument();
    });
  });

  // WebSocket Tests
  describe('WebSocket Integration', () => {
    it('connects to WebSocket when wsEndpoint provided', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} wsEndpoint="ws://localhost:8080" />);
      expect(MockWebSocket.instances.length).toBe(1);
      expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8080');
    });

    it('shows live indicator when connected', async () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} wsEndpoint="ws://localhost:8080" />);

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1);
      });
      MockWebSocket.simulateOpen();

      await waitFor(() => {
        expect(screen.getByText('Live')).toBeInTheDocument();
      });
    });

    it('shows disconnected indicator when closed', async () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} wsEndpoint="ws://localhost:8080" />);

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1);
      });
      MockWebSocket.simulateOpen();
      MockWebSocket.simulateClose();

      await waitFor(() => {
        expect(screen.getByText('Disconnected')).toBeInTheDocument();
      });
    });

    it('updates status on WebSocket message', async () => {
      const mockData = createMockStatusData();
      const onStageChange = vi.fn();
      render(
        <PRStatusTracker 
          initialData={mockData} 
          wsEndpoint="ws://localhost:8080"
          onStageChange={onStageChange}
        />
      );

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1);
      });
      MockWebSocket.simulateOpen();

      // Simulate status update
      MockWebSocket.simulateMessage({
        type: 'pr_status_update',
        prId: 'pr-123',
        stage: 'ai_review',
        status: 'running',
        payload: {
          ...mockData,
          currentStage: 'ai_review',
          stages: {
            ...mockData.stages,
            ai_review: { status: 'running' },
          },
        },
      });
      
      await waitFor(() => {
        expect(onStageChange).toHaveBeenCalledWith('ai_review', 'running');
      });
    });

    it('handles WebSocket errors', async () => {
      const mockData = createMockStatusData();
      const onError = vi.fn();
      render(
        <PRStatusTracker 
          initialData={mockData} 
          wsEndpoint="ws://localhost:8080"
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1);
      });
      MockWebSocket.simulateError();
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    });

    it('does not show live indicator without wsEndpoint', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
      expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
    });
  });

  // Compact Mode Tests
  describe('Compact Mode', () => {
    it('renders in compact mode', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} compact />);
      expect(screen.getByText(/PR #123 Status/)).toBeInTheDocument();
    });

    it('hides detailed information in compact mode', () => {
      const mockData = createMockStatusDataWithScores();
      render(<PRStatusTracker initialData={mockData} compact />);
      // AI score breakdown should not be visible in compact mode
      expect(screen.queryByText('AI Score Breakdown')).not.toBeInTheDocument();
    });

    it('uses smaller padding in compact mode', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} compact />);
      const mainContainer = screen.getByTestId('pr-status-tracker');
      expect(mainContainer).toHaveClass('p-4');
    });
  });

  // Responsive Design Tests
  describe('Responsive Design', () => {
    it('uses responsive grid for stages', () => {
      const mockData = createMockStatusData();
      const { container } = render(<PRStatusTracker initialData={mockData} />);
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1');
      expect(grid).toHaveClass('sm:grid-cols-2');
      expect(grid).toHaveClass('lg:grid-cols-3');
      expect(grid).toHaveClass('xl:grid-cols-4');
    });

    it('uses single column in compact mode', () => {
      const mockData = createMockStatusData();
      const { container } = render(<PRStatusTracker initialData={mockData} compact />);
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1');
    });

    it('has touch-friendly buttons (min 44px)', () => {
      const mockData = createMockApprovedData();
      render(<PRStatusTracker initialData={mockData} />);
      const solscanLink = screen.getByText('View on Solscan').closest('a');
      expect(solscanLink).toHaveClass('min-h-[44px]');
    });
  });

  // Loading State Tests
  describe('Loading State', () => {
    it('shows loading spinner when no data', () => {
      render(<PRStatusTracker />);
      expect(screen.getByText('Loading PR status...')).toBeInTheDocument();
    });

    it('shows spinner animation', () => {
      const { container } = render(<PRStatusTracker />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  // Callback Tests
  describe('Callbacks', () => {
    it('calls onStageChange when stage updates', async () => {
      const mockData = createMockStatusData();
      const onStageChange = vi.fn();
      render(
        <PRStatusTracker 
          initialData={mockData} 
          wsEndpoint="ws://localhost:8080"
          onStageChange={onStageChange}
        />
      );

      await waitFor(() => {
        expect(MockWebSocket.instances.length).toBe(1);
      });
      MockWebSocket.simulateOpen();
      MockWebSocket.simulateMessage({
        type: 'pr_status_update',
        prId: 'pr-123',
        stage: 'human_review',
        status: 'running',
        payload: mockData,
      });
      
      await waitFor(() => {
        expect(onStageChange).toHaveBeenCalledWith('human_review', 'running');
      });
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      expect(screen.getByRole('heading', { level: 2, name: /PR #123 Status/ })).toBeInTheDocument();
    });

    it('has accessible links with target blank', () => {
      const mockData = createMockStatusData();
      render(<PRStatusTracker initialData={mockData} />);
      const githubLink = screen.getByText('View on GitHub →').closest('a');
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('external links open in new tab', () => {
      const mockData = createMockApprovedData();
      render(<PRStatusTracker initialData={mockData} />);
      const solscanLink = screen.getByText('View on Solscan').closest('a');
      expect(solscanLink).toHaveAttribute('target', '_blank');
    });
  });
});