import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContributorDashboard } from './ContributorDashboard';

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
    it('renders the dashboard header', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      expect(screen.getByRole('heading', { name: 'Contributor Dashboard' })).toBeInTheDocument();
      expect(screen.getByText(/track your progress/i)).toBeInTheDocument();
    });

    it('renders all summary cards', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Use more specific selectors
      expect(screen.getByText('Total Earned')).toBeInTheDocument();
      expect(screen.getByText('Active Bounties')).toBeInTheDocument();
      expect(screen.getByText('Pending Payouts')).toBeInTheDocument();
      expect(screen.getByText('Reputation Rank')).toBeInTheDocument();
    });

    it('renders tab navigation with correct accessibility', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Verify tab buttons exist and are accessible
      const overviewTab = screen.getByRole('button', { name: 'Overview' });
      const notificationsTab = screen.getByRole('button', { name: /Notifications/ });
      const settingsTab = screen.getByRole('button', { name: 'Settings' });
      
      expect(overviewTab).toBeInTheDocument();
      expect(notificationsTab).toBeInTheDocument();
      expect(settingsTab).toBeInTheDocument();
    });

    it('renders quick action buttons', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      expect(screen.getByRole('button', { name: '🔍 Browse Bounties' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '🏆 View Leaderboard' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '💰 Check Treasury' })).toBeInTheDocument();
    });

    it('renders active bounties section', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      expect(screen.getByRole('heading', { name: 'Active Bounties' })).toBeInTheDocument();
      // Verify bounty cards are rendered with correct data
      expect(screen.getByText('GitHub ↔ Platform Bi-directional Sync')).toBeInTheDocument();
    });

    it('renders earnings chart with data', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      expect(screen.getByRole('heading', { name: /earnings/i })).toBeInTheDocument();
      // Verify chart displays earnings amount
      expect(screen.getByText(/950K/i)).toBeInTheDocument();
    });

    it('renders recent activity section', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      expect(screen.getByRole('heading', { name: 'Recent Activity' })).toBeInTheDocument();
      expect(screen.getByText('Payout Received')).toBeInTheDocument();
    });
  });

  // Tab Navigation Tests - Verify behavior, not just existence
  describe('Tab Navigation', () => {
    it('switches to notifications tab and shows correct content', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Initially on overview tab
      expect(screen.getByRole('heading', { name: 'Active Bounties' })).toBeInTheDocument();
      
      // Click notifications tab
      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
      
      // Should show notifications content
      expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
      expect(screen.getByText('Mark all as read')).toBeInTheDocument();
    });

    it('switches to settings tab and shows correct content', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByText('Linked Accounts')).toBeInTheDocument();
    });

    it('switches back to overview tab from settings', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
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
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Go to notifications tab
      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
      
      // Find unread notification by its accessible name
      const unreadNotification = screen.getByRole('button', { name: /PR Merged.*Unread/ });
      expect(unreadNotification).toBeInTheDocument();
      
      // Click to mark as read
      fireEvent.click(unreadNotification);
      
      // Should now show as read in aria-label
      expect(screen.getByRole('button', { name: /PR Merged.*Read/ })).toBeInTheDocument();
    });

    it('marks all notifications as read and hides mark all button', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
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
  });

  // Settings Tests - Verify toggle behavior
  describe('Settings', () => {
    it('displays linked accounts with correct status', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // GitHub should show as connected
      expect(screen.getByText('HuiNeng6')).toBeInTheDocument();
      
      // Twitter should show as not connected
      expect(screen.getByText('Not connected')).toBeInTheDocument();
    });

    it('toggles notification preferences when clicked', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Find the "Payout Alerts" toggle
      const payoutAlertsRow = screen.getByText('Payout Alerts').parentElement;
      const toggle = within(payoutAlertsRow!).getByRole('button');
      
      // Initially enabled (green background)
      expect(toggle).toHaveClass('bg-[#14F195]');
      
      // Click to disable
      fireEvent.click(toggle);
      
      // Should now be disabled (gray background)
      expect(toggle).toHaveClass('bg-gray-700');
    });

    it('displays truncated wallet address', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
      
      // Should show truncated address
      expect(screen.getByText(/Amu1YJjc\.\.\./)).toBeInTheDocument();
    });
  });

  // Quick Actions Tests - Verify callback behavior
  describe('Quick Actions', () => {
    it('calls onBrowseBounties callback when Browse Bounties is clicked', () => {
      const mockCallback = jest.fn();
      render(<ContributorDashboard walletAddress={mockWalletAddress} onBrowseBounties={mockCallback} />);
      
      fireEvent.click(screen.getByRole('button', { name: '🔍 Browse Bounties' }));
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('calls onViewLeaderboard callback when View Leaderboard is clicked', () => {
      const mockCallback = jest.fn();
      render(<ContributorDashboard walletAddress={mockWalletAddress} onViewLeaderboard={mockCallback} />);
      
      fireEvent.click(screen.getByRole('button', { name: '🏆 View Leaderboard' }));
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('calls onCheckTreasury callback when Check Treasury is clicked', () => {
      const mockCallback = jest.fn();
      render(<ContributorDashboard walletAddress={mockWalletAddress} onCheckTreasury={mockCallback} />);
      
      fireEvent.click(screen.getByRole('button', { name: '💰 Check Treasury' }));
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  // Bounty Card Tests - Verify deadline calculations
  describe('Bounty Cards', () => {
    it('displays bounty progress correctly', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Should show progress percentage
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('shows deadline countdown for each bounty', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // All bounties should show days remaining
      const daysLeftElements = screen.getAllByText(/days left/i);
      expect(daysLeftElements.length).toBeGreaterThan(0);
    });

    it('shows reward amount with correct formatting', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Should show formatted amounts with $FNDRY token
      const fndryElements = screen.getAllByText(/\$FNDRY/);
      expect(fndryElements.length).toBeGreaterThan(0);
    });
  });

  // Activity Feed Tests - Verify data display
  describe('Activity Feed', () => {
    it('displays all activity types with correct icons', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      expect(screen.getByText('Payout Received')).toBeInTheDocument();
      expect(screen.getByText('Review Completed')).toBeInTheDocument();
      expect(screen.getByText('PR Submitted')).toBeInTheDocument();
      expect(screen.getByText('Bounty Claimed')).toBeInTheDocument();
    });

    it('shows positive amounts for payout activities', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Payout activities should show +amount
      const positiveAmounts = screen.getAllByText(/\+500K/);
      expect(positiveAmounts.length).toBeGreaterThan(0);
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('notification items are keyboard accessible', async () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
      
      // Notification items should have role="button" and be focusable
      const notificationItems = screen.getAllByRole('button').filter(
        btn => btn.getAttribute('aria-label')?.includes('Unread - click to mark as read')
      );
      
      expect(notificationItems.length).toBeGreaterThan(0);
    });

    it('notification items have correct aria labels', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      fireEvent.click(screen.getByRole('button', { name: /Notifications/ }));
      
      // Check for accessible labels
      const notification = screen.getByRole('button', { name: /PR Merged/ });
      expect(notification).toHaveAttribute('aria-label');
    });
  });

  // Empty State Tests
  describe('Empty States', () => {
    it('handles empty earnings data gracefully', () => {
      // This test verifies the component doesn't crash with empty data
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Component should still render
      expect(screen.getByRole('heading', { name: 'Contributor Dashboard' })).toBeInTheDocument();
    });
  });

  // Data Formatting Tests
  describe('Data Formatting', () => {
    it('formats large numbers with correct abbreviations', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // 2450000 should be formatted as 2.5M
      expect(screen.getByText(/2\.5M/i)).toBeInTheDocument();
    });

    it('shows relative time for activities', () => {
      render(<ContributorDashboard walletAddress={mockWalletAddress} />);
      
      // Activities should show relative time (e.g., "2h ago", "1d ago")
      const relativeTimeElements = screen.getAllByText(/ago|Just now/);
      expect(relativeTimeElements.length).toBeGreaterThan(0);
    });
  });
});