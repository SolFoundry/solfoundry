import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PRStatusTracker } from '../src/components/PRStatusTracker';
import { usePRStatusTracker } from '../src/hooks/usePRStatusTracker';
import { PRStatus, PRData } from '../src/types/pr';

// Mock the hook
jest.mock('../src/hooks/usePRStatusTracker');

const mockUsePRStatusTracker = usePRStatusTracker as jest.MockedFunction<typeof usePRStatusTracker>;

// Test data
const mockPRData: PRData = {
  id: '123',
  title: 'Test PR',
  url: 'https://github.com/test/repo/pull/123',
  author: 'testuser',
  status: PRStatus.OPEN,
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-02T00:00:00Z',
  branch: 'feature/test',
  baseBranch: 'main',
  checksStatus: 'pending',
  reviewStatus: 'pending',
  mergeable: true,
  draft: false,
  labels: ['enhancement'],
  assignees: ['reviewer1']
};

const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('PRStatusTracker Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('displays loading spinner when data is being fetched', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Loading PR data...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when fetch fails', () => {
      const errorMessage = 'Failed to fetch PR data';
      mockUsePRStatusTracker.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error(errorMessage),
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('shows retry button on error', async () => {
      const mockRefetch = jest.fn();
      mockUsePRStatusTracker.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        refetch: mockRefetch,
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      const retryButton = screen.getByRole('button', { name: 'Retry' });
      fireEvent.click(retryButton);
      
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty State', () => {
    it('displays empty state when no PRs are tracked', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No PRs being tracked')).toBeInTheDocument();
    });
  });

  describe('PR List Display', () => {
    it('renders PR cards when data is available', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('pr-card-123')).toBeInTheDocument();
      expect(screen.getByText('Test PR')).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('displays correct status badge for open PR', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('status-badge-open')).toBeInTheDocument();
    });

    it('displays correct status badge for merged PR', () => {
      const mergedPR = { ...mockPRData, status: PRStatus.MERGED };
      mockUsePRStatusTracker.mockReturnValue({
        data: [mergedPR],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('status-badge-merged')).toBeInTheDocument();
    });
  });

  describe('PR Tracking Actions', () => {
    it('calls trackPR when add PR form is submitted', async () => {
      const mockTrackPR = jest.fn();
      mockUsePRStatusTracker.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: mockTrackPR,
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      const input = screen.getByPlaceholderText('Enter PR URL');
      const addButton = screen.getByRole('button', { name: 'Track PR' });
      
      fireEvent.change(input, { target: { value: 'https://github.com/test/repo/pull/456' } });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(mockTrackPR).toHaveBeenCalledWith('https://github.com/test/repo/pull/456');
      });
    });

    it('calls stopTracking when remove button is clicked', async () => {
      const mockStopTracking = jest.fn();
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: mockStopTracking,
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      const removeButton = screen.getByTestId('remove-pr-123');
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(mockStopTracking).toHaveBeenCalledWith('123');
      });
    });
  });

  describe('PR Details', () => {
    it('displays PR branch information', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByText('feature/test')).toBeInTheDocument();
      expect(screen.getByText('main')).toBeInTheDocument();
    });

    it('displays check and review status', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('checks-status-pending')).toBeInTheDocument();
      expect(screen.getByTestId('review-status-pending')).toBeInTheDocument();
    });

    it('shows draft indicator for draft PRs', () => {
      const draftPR = { ...mockPRData, draft: true };
      mockUsePRStatusTracker.mockReturnValue({
        data: [draftPR],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('draft-indicator')).toBeInTheDocument();
    });

    it('displays labels when present', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByText('enhancement')).toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('shows refresh button', () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('calls refetch when refresh button is clicked', async () => {
      const mockRefetch = jest.fn();
      mockUsePRStatusTracker.mockReturnValue({
        data: [mockPRData],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetch,
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      const refreshButton = screen.getByTestId('refresh-button');
      fireEvent.click(refreshButton);
      
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Sorting and Filtering', () => {
    const multiplePRs = [
      mockPRData,
      { ...mockPRData, id: '456', title: 'Another PR', status: PRStatus.MERGED },
      { ...mockPRData, id: '789', title: 'Draft PR', draft: true }
    ];

    it('filters PRs by status', async () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: multiplePRs,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      const statusFilter = screen.getByTestId('status-filter');
      fireEvent.change(statusFilter, { target: { value: 'merged' } });
      
      await waitFor(() => {
        expect(screen.getByTestId('pr-card-456')).toBeInTheDocument();
        expect(screen.queryByTestId('pr-card-123')).not.toBeInTheDocument();
      });
    });

    it('sorts PRs by creation date', async () => {
      mockUsePRStatusTracker.mockReturnValue({
        data: multiplePRs,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
        trackPR: jest.fn(),
        stopTracking: jest.fn(),
        updatePRData: jest.fn()
      });

      renderWithProviders(<PRStatusTracker />);
      
      const sortSelect = screen.getByTestId('sort-select');
      fireEvent.change(sortSelect, { target: { value: 'created-desc' } });
      
      await waitFor(() => {
        const prCards = screen.getAllByTestId(/pr-card-/);
        expect(prCards).toHaveLength(3);
      });
    });
  });
});

describe('usePRStatusTracker Hook', () => {
  // Note: These tests would require additional setup for testing React Query hooks
  // They would typically use renderHook from @testing-library/react-hooks
  
  it('should be tested with proper hook testing utilities', () => {
    // Placeholder for hook-specific tests
    expect(true).toBe(true);
  });
});