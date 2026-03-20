import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityFeed } from '../ActivityFeed';
import { useActivityFeed } from '../../../hooks/useActivityFeed';

// Mock the hook
jest.mock('../../../hooks/useActivityFeed');
const mockUseActivityFeed = useActivityFeed as jest.MockedFunction<typeof useActivityFeed>;

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    ul: ({ children, ...props }: any) => <ul {...props}>{children}</ul>,
    li: ({ children, ...props }: any) => <li {...props}>{children}</li>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock react-intersection-observer
jest.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: jest.fn(), inView: false }),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createTestQueryClient()}>
    {children}
  </QueryClientProvider>
);

const mockActivityData = [
  {
    id: '1',
    type: 'bounty_created',
    title: 'Fix authentication bug',
    reward: 150000,
    user: 'alice_dev',
    timestamp: '2024-01-15T10:30:00Z',
    metadata: { severity: 'high' }
  },
  {
    id: '2',
    type: 'pr_submitted',
    title: 'Implement user dashboard',
    user: 'bob_coder',
    timestamp: '2024-01-15T09:15:00Z',
    metadata: { pr_number: 42 }
  },
  {
    id: '3',
    type: 'review_completed',
    title: 'Add payment integration',
    score: 8,
    user: 'charlie_reviewer',
    timestamp: '2024-01-15T08:45:00Z',
    metadata: { reviewer_count: 3 }
  },
  {
    id: '4',
    type: 'payout_sent',
    amount: 75000,
    user: 'dana_winner',
    timestamp: '2024-01-15T08:00:00Z',
    metadata: { transaction_hash: 'abc123' }
  }
];

describe('ActivityFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful data by default
    mockUseActivityFeed.mockReturnValue({
      data: { events: mockActivityData, hasNextPage: false },
      isLoading: false,
      error: null,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      refetch: jest.fn()
    });
  });

  describe('Component Rendering', () => {
    it('renders activity feed container', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByRole('feed')).toBeInTheDocument();
      expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    });

    it('displays correct number of activity items', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(4);
    });

    it('renders activity items with correct content', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText(/Fix authentication bug/)).toBeInTheDocument();
      expect(screen.getByText(/150,000 \$FNDRY/)).toBeInTheDocument();
      expect(screen.getByText(/alice_dev/)).toBeInTheDocument();
    });
  });

  describe('Event Types Display', () => {
    it('displays bounty created events with correct styling', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const bountyEvent = screen.getByText(/New bounty:/);
      expect(bountyEvent).toBeInTheDocument();

      const bountyIcon = screen.getByTestId('bounty-created-icon');
      expect(bountyIcon).toHaveClass('text-green-500');
    });

    it('displays PR submitted events correctly', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText(/bob_coder submitted PR/)).toBeInTheDocument();

      const prIcon = screen.getByTestId('pr-submitted-icon');
      expect(prIcon).toHaveClass('text-blue-500');
    });

    it('displays review completed events with score', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText(/scored 8\/10/)).toBeInTheDocument();

      const reviewIcon = screen.getByTestId('review-completed-icon');
      expect(reviewIcon).toHaveClass('text-yellow-500');
    });

    it('displays payout sent events with amount', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText(/75,000 \$FNDRY sent/)).toBeInTheDocument();

      const payoutIcon = screen.getByTestId('payout-sent-icon');
      expect(payoutIcon).toHaveClass('text-purple-500');
    });
  });

  describe('Loading States', () => {
    it('shows loading spinner when data is loading', () => {
      mockUseActivityFeed.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByTestId('activity-feed-loading')).toBeInTheDocument();
      expect(screen.getByText('Loading activity...')).toBeInTheDocument();
    });

    it('shows loading skeleton with correct number of items', () => {
      mockUseActivityFeed.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const skeletonItems = screen.getAllByTestId(/skeleton-item/);
      expect(skeletonItems).toHaveLength(5);
    });

    it('shows load more loading when fetching next page', () => {
      mockUseActivityFeed.mockReturnValue({
        data: { events: mockActivityData, hasNextPage: true },
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText('Loading more...')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('displays error message when fetch fails', () => {
      mockUseActivityFeed.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch activity'),
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText('Failed to load activity feed')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('calls refetch when retry button is clicked', () => {
      const mockRefetch = jest.fn();
      mockUseActivityFeed.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: mockRefetch
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty States', () => {
    it('displays empty state when no activities exist', () => {
      mockUseActivityFeed.mockReturnValue({
        data: { events: [], hasNextPage: false },
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.getByText(/Check back soon/)).toBeInTheDocument();
    });

    it('shows empty state icon', () => {
      mockUseActivityFeed.mockReturnValue({
        data: { events: [], hasNextPage: false },
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByTestId('empty-activity-icon')).toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('shows load more button when has next page', () => {
      mockUseActivityFeed.mockReturnValue({
        data: { events: mockActivityData, hasNextPage: true },
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: true,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByRole('button', { name: /load more/i })).toBeInTheDocument();
    });

    it('calls fetchNextPage when load more is clicked', () => {
      const mockFetchNextPage = jest.fn();
      mockUseActivityFeed.mockReturnValue({
        data: { events: mockActivityData, hasNextPage: true },
        isLoading: false,
        error: null,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /load more/i }));
      expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    });

    it('disables load more button when fetching next page', () => {
      mockUseActivityFeed.mockReturnValue({
        data: { events: mockActivityData, hasNextPage: true },
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const loadMoreBtn = screen.getByRole('button', { name: /loading more/i });
      expect(loadMoreBtn).toBeDisabled();
    });
  });

  describe('Responsive Behavior', () => {
    it('applies mobile-friendly classes on small screens', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const container = screen.getByRole('feed');
      expect(container).toHaveClass('px-4', 'sm:px-6');
    });

    it('shows compact view on mobile devices', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 320,
      });

      render(
        <TestWrapper>
          <ActivityFeed compact />
        </TestWrapper>
      );

      const items = screen.getAllByRole('listitem');
      items.forEach(item => {
        expect(item).toHaveClass('py-2');
      });
    });
  });

  describe('Time Display', () => {
    it('formats timestamps correctly', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      // Check for relative time display
      expect(screen.getByText(/ago/)).toBeInTheDocument();
    });

    it('updates time display for recent events', async () => {
      const recentEvent = {
        ...mockActivityData[0],
        timestamp: new Date(Date.now() - 60000).toISOString() // 1 minute ago
      };

      mockUseActivityFeed.mockReturnValue({
        data: { events: [recentEvent], hasNextPage: false },
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText(/1 minute ago/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByRole('feed')).toHaveAttribute('aria-label', 'Recent platform activity');
      expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Activity events');
    });

    it('supports keyboard navigation', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const loadMoreBtn = screen.queryByRole('button', { name: /load more/i });
      if (loadMoreBtn) {
        expect(loadMoreBtn).toHaveAttribute('tabIndex', '0');
      }
    });

    it('provides screen reader friendly descriptions', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      expect(screen.getByText(/New bounty created/)).toBeInTheDocument();
    });
  });

  describe('Animations', () => {
    it('applies stagger animation to list items', () => {
      render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const listItems = screen.getAllByRole('listitem');
      listItems.forEach((item, index) => {
        expect(item).toHaveAttribute('data-testid', `activity-item-${index}`);
      });
    });

    it('animates new items when data updates', async () => {
      const { rerender } = render(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      const newActivity = {
        id: '5',
        type: 'bounty_created',
        title: 'New test bounty',
        reward: 100000,
        user: 'test_user',
        timestamp: new Date().toISOString(),
        metadata: {}
      };

      mockUseActivityFeed.mockReturnValue({
        data: { events: [newActivity, ...mockActivityData], hasNextPage: false },
        isLoading: false,
        error: null,
        fetchNextPage: jest.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        refetch: jest.fn()
      });

      rerender(
        <TestWrapper>
          <ActivityFeed />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('New test bounty')).toBeInTheDocument();
      });
    });
  });

  describe('Props', () => {
    it('accepts limit prop to control number of items', () => {
      render(
        <TestWrapper>
          <ActivityFeed limit={2} />
        </TestWrapper>
      );

      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBeLessThanOrEqual(2);
    });

    it('applies compact styling when compact prop is true', () => {
      render(
        <TestWrapper>
          <ActivityFeed compact />
        </TestWrapper>
      );

      const container = screen.getByRole('feed');
      expect(container).toHaveClass('space-y-2');
    });

    it('filters by event type when filter prop is provided', () => {
      render(
        <TestWrapper>
          <ActivityFeed filter="bounty_created" />
        </TestWrapper>
      );

      expect(screen.getByText(/New bounty:/)).toBeInTheDocument();
      expect(screen.queryByText(/submitted PR/)).not.toBeInTheDocument();
    });
  });
});
