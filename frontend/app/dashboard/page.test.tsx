import { render, screen, fireEvent } from '@testing-library/react';
import DashboardPage from './page';

describe('DashboardPage', () => {
  it('renders summary cards with correct data', () => {
    render(<DashboardPage />);
    
    expect(screen.getByText('Total Earned')).toBeInTheDocument();
    expect(screen.getByText('Active Bounties')).toBeInTheDocument();
    expect(screen.getByText('Pending Payouts')).toBeInTheDocument();
    expect(screen.getByText('Reputation Rank')).toBeInTheDocument();
  });

  it('displays earnings chart title', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Earnings (Last 30 Days)')).toBeInTheDocument();
  });

  it('shows active bounties section', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Active Bounties')).toBeInTheDocument();
    expect(screen.getByText('Liquidity Pool V2')).toBeInTheDocument();
    expect(screen.getByText('Cross-chain Bridge Security')).toBeInTheDocument();
    expect(screen.getByText('Token Vesting Schedule')).toBeInTheDocument();
  });

  it('shows recent activity feed', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows quick actions', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Browse Bounties')).toBeInTheDocument();
    expect(screen.getByText('View Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Check Treasury')).toBeInTheDocument();
  });

  it('shows settings section', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Linked Accounts')).toBeInTheDocument();
    expect(screen.getByText('Notification Preferences')).toBeInTheDocument();
    expect(screen.getByText('Wallet Management')).toBeInTheDocument();
  });

  it('opens notification center on click', () => {
    render(<DashboardPage />);
    
    const notificationButton = screen.getByRole('button');
    fireEvent.click(notificationButton);
    
    expect(screen.getByText('Mark all as read')).toBeInTheDocument();
  });

  it('displays notification badge with unread count', () => {
    render(<DashboardPage />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
