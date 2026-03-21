import { render, screen } from '@testing-library/react';
import { ContributorProfile } from './ContributorProfile';

describe('ContributorProfile', () => {
  const defaultProps = {
    username: 'testuser',
    avatarUrl: 'https://example.com/avatar.png',
    walletAddress: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAjxgpetJrZp7N71o7',
    totalEarned: 10000,
    bountiesCompleted: 5,
    reputationScore: 100,
  };

  it('renders username correctly', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText('testuser')).toBeInTheDocument();
  });

  it('displays truncated wallet address', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText(/Amu1YJ.*1o7/)).toBeInTheDocument();
  });

  it('displays total earned', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText(/10,000 FNDRY/)).toBeInTheDocument();
  });

  it('displays bounties completed', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('displays reputation score', () => {
    render(<ContributorProfile {...defaultProps} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('disables hire button with placeholder text', () => {
    render(<ContributorProfile {...defaultProps} />);
    const button = screen.getByRole('button', { name: /Hire as Agent/ });
    expect(button).toBeDisabled();
  });

  it('handles missing avatar with initial', () => {
    render(<ContributorProfile {...defaultProps} avatarUrl={undefined} />);
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('handles missing wallet address', () => {
    render(<ContributorProfile {...defaultProps} walletAddress="" />);
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });
});