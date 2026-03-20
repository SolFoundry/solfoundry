import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContributorDashboard } from './ContributorDashboard';
import { mockDashboardData } from '../data/mockDashboard';

const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockUpdatePrefs = vi.fn();
const mockConnectAccount = vi.fn();
const mockDisconnectAccount = vi.fn();

describe('ContributorDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the dashboard header with username', () => {
      render(<ContributorDashboard username="TestUser" />);
      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });

    it('renders all summary cards in overview tab', () => {
      render(<ContributorDashboard />);
      // Use getAllByText since text may appear multiple times
      const totalEarnedElements = screen.getAllByText('Total Earned');
      expect(totalEarnedElements.length).toBeGreaterThan(0);
      const activeBountiesElements = screen.getAllByText('Active Bounties');
      expect(activeBountiesElements.length).toBeGreaterThan(0);
      const pendingPayoutsElements = screen.getAllByText('Pending Payouts');
      expect(pendingPayoutsElements.length).toBeGreaterThan(0);
      const successRateElements = screen.getAllByText('Success Rate');
      expect(successRateElements.length).toBeGreaterThan(0);
    });

    it('renders quick actions', () => {
      render(<ContributorDashboard />);
      expect(screen.getByText('Browse Bounties')).toBeInTheDocument();
      expect(screen.getByText('View Leaderboard')).toBeInTheDocument();
      expect(screen.getByText('Check Treasury')).toBeInTheDocument();
      expect(screen.getByText('View Profile')).toBeInTheDocument();
    });

    it('renders tab navigation', () => {
      render(<ContributorDashboard />);
      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /active bounties/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /earnings/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
    });

    it('shows unread notification count badge', () => {
      render(<ContributorDashboard />);
      const badge = screen.getByText('2');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('switches to bounties tab when clicked', () => {
      render(<ContributorDashboard />);
      fireEvent.click(screen.getByRole('tab', { name: /active bounties/i }));
      expect(screen.getByText('GitHub ↔ Platform Bi-directional Sync')).toBeInTheDocument();
    });

    it('switches to earnings tab when clicked', () => {
      render(<ContributorDashboard />);
      fireEvent.click(screen.getByRole('tab', { name: /earnings/i }));
      expect(screen.getByText('Earnings Over Time')).toBeInTheDocument();
    });

    it('switches to activity tab when clicked', () => {
      render(<ContributorDashboard />);
      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));
      expect(screen.getByText('Payout Received')).toBeInTheDocument();
    });

    it('switches to notifications tab when clicked', () => {
      render(<ContributorDashboard />);
      fireEvent.click(screen.getByRole('tab', { name: /notifications/i }));
      expect(screen.getByText('Deadline Approaching')).toBeInTheDocument();
    });

    it('switches to settings tab when clicked', () => {
      render(<ContributorDashboard />);
      fireEvent.click(screen.getByRole('tab', { name: /settings/i }));
      // Check for settings content - use getAllByText since text may appear multiple times
      const walletElements = screen.getAllByText(/Wallet/i);
      expect(walletElements.length).toBeGreaterThan(0);
    });
  });

  describe('Summary Cards', () => {
    it('displays total earned amount', () => {
      render(<ContributorDashboard data={mockDashboardData} />);
      expect(screen.getByText(/1,250,000/)).toBeInTheDocument();
    });

    it('displays active bounties count', () => {
      render(<ContributorDashboard data={mockDashboardData} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('displays success rate', () => {
      render(<ContributorDashboard data={mockDashboardData} />);
      expect(screen.getByText('91%')).toBeInTheDocument();
    });
  });

  describe('Notifications', () => {
    it('marks notification as read when clicked', () => {
      render(<ContributorDashboard onMarkNotificationRead={mockMarkRead} />);
      fireEvent.click(screen.getByRole('tab', { name: /notifications/i }));
      const markReadButtons = screen.getAllByText('Mark as read');
      fireEvent.click(markReadButtons[0]);
      expect(mockMarkRead).toHaveBeenCalled();
    });

    it('marks all notifications as read', () => {
      render(<ContributorDashboard onMarkAllNotificationsRead={mockMarkAllRead} />);
      fireEvent.click(screen.getByRole('tab', { name: /notifications/i }));
      fireEvent.click(screen.getByText('Mark all as read'));
      expect(mockMarkAllRead).toHaveBeenCalled();
    });
  });

  describe('Settings', () => {
    it('displays connected wallet address', () => {
      render(<ContributorDashboard />);
      fireEvent.click(screen.getByRole('tab', { name: /settings/i }));
      // Use getAllByText since the address might appear multiple times
      const walletElements = screen.getAllByText(/Amu1YJjc/);
      expect(walletElements.length).toBeGreaterThan(0);
    });

    it('displays linked accounts status', () => {
      render(<ContributorDashboard />);
      fireEvent.click(screen.getByRole('tab', { name: /settings/i }));
      // Use getAllByText since HuiNeng6 might appear multiple times
      const userElements = screen.getAllByText('HuiNeng6');
      expect(userElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('has proper tab roles', () => {
      render(<ContributorDashboard />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(6);
    });

    it('has aria-selected on active tab', () => {
      render(<ContributorDashboard />);
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    });
  });
});