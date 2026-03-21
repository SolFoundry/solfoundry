import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ContributorDashboard } from './ContributorDashboard';
import { vi, beforeEach } from 'vitest';

// ============================================================================
// Mock fetch for API calls made by ContributorDashboard (React Query)
// ============================================================================

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Build a mock fetch Response for the given data. */
function makeResponse(data: unknown): Response {
  return {
    ok: true, status: 200, statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Mock bounties for dashboard tests. */
const dashboardBounties = [
  { id: 'b1', title: 'Fix escrow bug', reward_amount: 5000, deadline: '2026-04-15', status: 'in_progress', progress: 50 },
  { id: 'b2', title: 'Build staking UI', reward_amount: 3000, deadline: '2026-04-20', status: 'claimed', progress: 20 },
];
/** Mock notifications for dashboard tests. */
const dashboardNotifications = [
  { id: 'n1', type: 'success', title: 'Bounty Completed', message: 'You completed a bounty!', created_at: new Date(Date.now() - 3600000).toISOString(), read: false },
  { id: 'n2', type: 'info', title: 'New Review', message: 'Your PR was reviewed.', created_at: new Date(Date.now() - 7200000).toISOString(), read: true },
];
/** Mock leaderboard for dashboard tests. */
const dashboardLeaderboard = [
  { username: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7', rank: 1, earningsFndry: 25000, bountiesCompleted: 10 },
  { username: 'alice', rank: 2, earningsFndry: 15000, bountiesCompleted: 7 },
];

beforeEach(() => {
  mockFetch.mockReset();
  // Route-aware mock: return different data based on URL
  mockFetch.mockImplementation((urlArg: unknown) => {
    const url = String(urlArg ?? '');
    if (url.includes('/bounties')) return Promise.resolve(makeResponse({ items: dashboardBounties }));
    if (url.includes('/notifications')) return Promise.resolve(makeResponse({ items: dashboardNotifications }));
    if (url.includes('/leaderboard')) return Promise.resolve(makeResponse(dashboardLeaderboard));
    return Promise.resolve(makeResponse({ items: [] }));
  });
});

/** Wrap component in QueryClientProvider for React Query hooks. */
function renderWithQuery(element: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {element}
    </QueryClientProvider>,
  );
}

// ============================================================================
// Mock Data
// ============================================================================

const mockWalletAddress = 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7';

// ============================================================================
// Tests
// ============================================================================

describe('ContributorDashboard', () => {
  // Basic Rendering Tests
  describe('Rendering', () => {
    it('renders the dashboard header after loading', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Should show loading initially
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Contributor Dashboard' })).toBeInTheDocument();
      });
      
      expect(screen.getByText(/track your progress/i)).toBeInTheDocument();
    });

    it('renders all summary cards after loading', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Earned')).toBeInTheDocument();
      });
      
      // Use more specific selectors
      expect(screen.getByText('Active Bounties')).toBeInTheDocument();
      expect(screen.getByText('Pending Payouts')).toBeInTheDocument();
      expect(screen.getByText('Reputation Rank')).toBeInTheDocument();
    });

    it('renders tab navigation with correct accessibility', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
      });
      
      // Verify tab buttons exist and are accessible
      const overviewTab = screen.getByRole('button', { name: 'Overview' });
      const notificationsTab = screen.getByRole('button', { name: /Notifications/ });
      const settingsTab = screen.getByRole('button', { name: 'Settings' });
      
      expect(overviewTab).toBeInTheDocument();
      expect(notificationsTab).toBeInTheDocument();
      expect(settingsTab).toBeInTheDocument();
    });

    it('renders quick action buttons after loading', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Browse Bounties/ })).toBeInTheDocument();
      });
      
      expect(screen.getByRole('button', { name: /View Leaderboard/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Check Treasury/ })).toBeInTheDocument();
    });

    it('renders active bounties section after loading', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Active Bounties' })).toBeInTheDocument();
      });

      // Verify bounty cards are rendered with correct data from mock
      expect(screen.getByText('Fix escrow bug')).toBeInTheDocument();
    });

    it('renders earnings chart section after loading', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByText(/Earnings/)).toBeInTheDocument();
      });

      // Earnings chart renders (may show "No earnings data available" since mock has no earnings)
      expect(screen.getByText(/Earnings/)).toBeInTheDocument();
    });

    it('renders recent activity section after loading', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
      });

      // Activities section renders (may show "No recent activity" when API returns no activity data)
      expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
    });
  });

  // Loading State Tests
  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Should show loading state
      expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('hides loading spinner after data loads', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading dashboard...')).not.toBeInTheDocument();
      });
      
      // Should show main content instead
      expect(screen.getByRole('heading', { name: 'Contributor Dashboard' })).toBeInTheDocument();
    });
  });

  // Tab Navigation Tests - Verify behavior, not just existence
  describe('Tab Navigation', () => {
    it('switches to notifications tab and shows correct content', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Wait for loading
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
      });
      
      // Initially on overview tab
      expect(screen.getByRole('heading', { name: 'Active Bounties' })).toBeInTheDocument();
      
      // Click notifications tab
      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
      
      // Should show notifications content
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });

    it('switches to settings tab and shows correct content', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByText('Linked Accounts')).toBeInTheDocument();
    });

    it('switches back to overview tab from settings', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });
      
      // Go to settings
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      
      // Go back to overview
      fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
      expect(screen.getByRole('heading', { name: 'Active Bounties' })).toBeInTheDocument();
    });
  });

  // Notification Tests - Verify behavior changes
  describe('Notifications', () => {
    it('marks notification as read when clicked', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      // Wait for loading and go to notifications tab
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));

      // Find unread notification by its accessible name (matches mock data)
      const unreadNotification = screen.getByRole('button', { name: /Bounty Completed.*Unread/ });
      expect(unreadNotification).toBeInTheDocument();

      // Click to mark as read
      fireEvent.click(unreadNotification);

      // Should now show as read in aria-label
      expect(screen.getByRole('button', { name: /Bounty Completed.*Read/ })).toBeInTheDocument();
    });

    it('marks all notifications as read and hides mark all button', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
      });
      
      // Go to notifications tab
      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
      
      // Verify mark all as read button exists
      const markAllButton = screen.getByRole('button', { name: 'Mark all as read' });
      expect(markAllButton).toBeInTheDocument();
      
      // Click mark all as read
      fireEvent.click(markAllButton);
      
      // Button should no longer appear
      expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument();
    });

    it('shows unread notification badge on tab', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
      });

      // Tab should have badge showing unread count (1 unread in mock data)
      const badge = screen.getByText('1');
      expect(badge).toBeInTheDocument();
      expect(badge.closest('button')).toHaveTextContent('Notifications');
    });
  });

  // Settings Tests - Verify toggle behavior
  describe('Settings', () => {
    it('displays linked accounts with correct status', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

      // Linked Accounts section is rendered
      expect(screen.getByText('Linked Accounts')).toBeInTheDocument();

      // Twitter should show as not connected
      expect(screen.getByText('Not connected')).toBeInTheDocument();
    });

    it('toggles notification preferences when clicked', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Find the "Payout Alerts" toggle
      const payoutAlertsRow = screen.getByText('Payout Alerts').closest('div');
      const toggle = within(payoutAlertsRow!).getByRole('switch');
      
      // Initially enabled (aria-checked should be true)
      expect(toggle).toHaveAttribute('aria-checked', 'true');
      
      // Click to disable
      fireEvent.click(toggle);
      
      // Should now be disabled (aria-checked should be false)
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    });

    it('displays truncated wallet address', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Should show truncated address
      expect(screen.getByText(/Amu1YJjc\.\.\./)).toBeInTheDocument();
    });

    it('calls onConnectAccount when Connect button is clicked', async () => {
      const mockConnect = vi.fn();
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} onConnectAccount={mockConnect} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Click Connect for Twitter (not connected)
      fireEvent.click(screen.getByRole('button', { name: 'Connect twitter' }));
      
      expect(mockConnect).toHaveBeenCalledWith('twitter');
    });

    it('calls onDisconnectAccount when Disconnect button is clicked', async () => {
      const mockDisconnect = vi.fn();
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} onDisconnectAccount={mockDisconnect} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Click Disconnect for GitHub (connected)
      fireEvent.click(screen.getByRole('button', { name: 'Disconnect github' }));
      
      expect(mockDisconnect).toHaveBeenCalledWith('github');
    });

    it('connect/disconnect buttons have correct aria attributes', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // GitHub is connected, so aria-pressed should be true
      const disconnectBtn = screen.getByRole('button', { name: 'Disconnect github' });
      expect(disconnectBtn).toHaveAttribute('aria-pressed', 'true');
      
      // Twitter is not connected, so aria-pressed should be false
      const connectBtn = screen.getByRole('button', { name: 'Connect twitter' });
      expect(connectBtn).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // Quick Actions Tests - Verify callback behavior
  describe('Quick Actions', () => {
    it('calls onBrowseBounties callback when Browse Bounties is clicked', async () => {
      const mockCallback = vi.fn();
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} onBrowseBounties={mockCallback} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Browse Bounties/ })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: /Browse Bounties/ }));
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('calls onViewLeaderboard callback when View Leaderboard is clicked', async () => {
      const mockCallback = vi.fn();
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} onViewLeaderboard={mockCallback} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /View Leaderboard/ })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: /View Leaderboard/ }));
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('calls onCheckTreasury callback when Check Treasury is clicked', async () => {
      const mockCallback = vi.fn();
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} onCheckTreasury={mockCallback} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Check Treasury/ })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: /Check Treasury/ }));
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  // Bounty Card Tests - Verify deadline calculations
  describe('Bounty Cards', () => {
    it('displays bounty progress correctly', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      // Should show progress percentages from mock data
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    it('shows deadline countdown for each bounty', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Active Bounties' })).toBeInTheDocument();
      });
      
      // All bounties should show days remaining
      const daysLeftElements = screen.getAllByText(/days left/i);
      expect(daysLeftElements.length).toBeGreaterThan(0);
    });

    it('shows reward amount with correct formatting', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Active Bounties' })).toBeInTheDocument();
      });
      
      // Should show formatted amounts with $FNDRY token
      const fndryElements = screen.getAllByText(/\$FNDRY/);
      expect(fndryElements.length).toBeGreaterThan(0);
    });
  });

  // Activity Feed Tests - Verify empty state and section rendering
  describe('Activity Feed', () => {
    it('shows Recent Activity section with empty state when no activities', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
      });

      // API mock doesn't return activity data, so empty state is shown
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('notification items are keyboard accessible', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
      
      // Notification items should have role="button" and be focusable
      const notificationItems = screen.getAllByRole('button').filter(
        btn => btn.getAttribute('aria-label')?.includes('Unread - click to mark as read')
      );
      
      expect(notificationItems.length).toBeGreaterThan(0);
    });

    it('notification items have correct aria labels', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));

      // Check for accessible labels (matches mock data notification title)
      const notification = screen.getByRole('button', { name: /Bounty Completed/ });
      expect(notification).toHaveAttribute('aria-label');
    });

    it('loading state has correct aria attributes', () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Loading container should have role="status" and aria-live="polite"
      const loadingContainer = screen.getByRole('status');
      expect(loadingContainer).toHaveAttribute('aria-live', 'polite');
    });
  });

  // Data Formatting Tests
  describe('Data Formatting', () => {
    it('formats large numbers with correct abbreviations', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByText('Total Earned')).toBeInTheDocument();
      });

      // 25000 from mock leaderboard earningsFndry formats as 25K
      expect(screen.getByText(/25K/)).toBeInTheDocument();
    });

    it('shows relative time for notifications', async () => {
      renderWithQuery(<ContributorDashboard walletAddress={mockWalletAddress} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Notifications/ })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));

      // Notifications should show relative time (e.g., "1h ago", "2h ago")
      const relativeTimeElements = screen.getAllByText(/ago|Just now/);
      expect(relativeTimeElements.length).toBeGreaterThan(0);
    });
  });

  // User ID prop usage test
  describe('User ID Prop', () => {
    it('accepts userId prop for data fetching', async () => {
      const userId = 'test-user-123';
      renderWithQuery(<ContributorDashboard userId={userId} walletAddress={mockWalletAddress} />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Contributor Dashboard' })).toBeInTheDocument();
      });
      
      // Component should render successfully with userId
      expect(screen.getByRole('heading', { name: 'Contributor Dashboard' })).toBeInTheDocument();
    });
  });
});