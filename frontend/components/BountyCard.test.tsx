import { render, screen, fireEvent } from '@testing-library/react';
import { BountyCard } from './BountyCard';
import { Bounty } from '@/data/mockBounties';

const mockBounty: Bounty = {
  id: 'test-bounty',
  title: 'Test Bounty',
  description: 'A test bounty description',
  tier: 'T1',
  status: 'open',
  reward: 500,
  deadline: Date.now() + 48 * 60 * 60 * 1000,
  createdAt: Date.now() - 2 * 60 * 60 * 1000,
  skills: ['React', 'TypeScript'],
  submissions: 3
};

describe('BountyCard', () => {
  it('renders bounty title', () => {
    render(<BountyCard bounty={mockBounty} />);
    expect(screen.getByText('Test Bounty')).toBeInTheDocument();
  });

  it('displays reward amount', () => {
    render(<BountyCard bounty={mockBounty} />);
    expect(screen.getByText(/500 FNDRY/)).toBeInTheDocument();
  });

  it('shows tier badge', () => {
    render(<BountyCard bounty={mockBounty} />);
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<BountyCard bounty={mockBounty} />);
    expect(screen.getByText('open')).toBeInTheDocument();
  });

  it('displays skills', () => {
    render(<BountyCard bounty={mockBounty} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('shows submission count', () => {
    render(<BountyCard bounty={mockBounty} />);
    expect(screen.getByText(/3 submissions/)).toBeInTheDocument();
  });

  it('calculates time remaining', () => {
    render(<BountyCard bounty={mockBounty} />);
    // Should show days for 48h deadline
    expect(screen.getByText(/d left/)).toBeInTheDocument();
  });

  it('handles T2 tier correctly', () => {
    const t2Bounty = { ...mockBounty, tier: 'T2' as const };
    render(<BountyCard bounty={t2Bounty} />);
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('handles T3 tier correctly', () => {
    const t3Bounty = { ...mockBounty, tier: 'T3' as const };
    render(<BountyCard bounty={t3Bounty} />);
    expect(screen.getByText('T3')).toBeInTheDocument();
  });

  it('handles in-progress status', () => {
    const progressBounty = { ...mockBounty, status: 'in-progress' as const };
    render(<BountyCard bounty={progressBounty} />);
    expect(screen.getByText('in-progress')).toBeInTheDocument();
  });

  it('handles completed status', () => {
    const completedBounty = { ...mockBounty, status: 'completed' as const };
    render(<BountyCard bounty={completedBounty} />);
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('truncates long skill lists', () => {
    const manySkillsBounty = {
      ...mockBounty,
      skills: ['React', 'TypeScript', 'Node.js', 'Python', 'Rust']
    };
    render(<BountyCard bounty={manySkillsBounty} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});