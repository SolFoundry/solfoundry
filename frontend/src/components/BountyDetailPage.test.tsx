import { render, screen } from '@testing-library/react';
import { BountyDetailPage } from './BountyDetailPage';

const mockBounty = {
  id: 'test-bounty-1',
  title: 'Test Bounty: Sample Implementation',
  tier: 'T1' as const,
  reward: 250000,
  category: 'Frontend',
  status: 'open' as const,
  deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
  description: 'This is a test bounty description.\n\nIt has multiple paragraphs.',
  requirements: [
    'Requirement 1: Implement the component',
    'Requirement 2: Add responsive design',
    'Requirement 3: Write tests',
  ],
  githubIssueUrl: 'https://github.com/test/repo/issues/21',
  githubIssueNumber: 21,
  views: 1234,
  submissions: [
    {
      id: 'sub-1',
      author: 'testuser',
      prUrl: 'https://github.com/test/repo/pull/101',
      prNumber: 101,
      status: 'reviewing' as const,
      reviewScore: 7.5,
    },
  ],
  activities: [
    {
      id: 'act-1',
      type: 'claimed' as const,
      actor: 'testuser',
      timestamp: '2 hours ago',
    },
    {
      id: 'act-2',
      type: 'pr_submitted' as const,
      actor: 'testuser',
      timestamp: '1 hour ago',
    },
  ],
};

describe('BountyDetailPage', () => {
  it('renders bounty title', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Test Bounty: Sample Implementation')).toBeInTheDocument();
  });

  it('renders tier badge', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('renders reward amount', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('250,000 FNDRY')).toBeInTheDocument();
  });

  it('renders category', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('OPEN')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText(/This is a test bounty description/)).toBeInTheDocument();
  });

  it('renders requirements', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Requirement 1: Implement the component')).toBeInTheDocument();
    expect(screen.getByText('Requirement 2: Add responsive design')).toBeInTheDocument();
    expect(screen.getByText('Requirement 3: Write tests')).toBeInTheDocument();
  });

  it('renders submissions', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText(/PR #101/)).toBeInTheDocument();
  });

  it('renders GitHub issue link', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText(/#21 View on GitHub/)).toBeInTheDocument();
  });

  it('renders quick stats', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Submissions')).toBeInTheDocument();
  });

  it('renders claim and submit buttons', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Claim Bounty')).toBeInTheDocument();
    expect(screen.getByText('Submit PR')).toBeInTheDocument();
  });

  it('renders activity feed', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText(/testuser/)).toBeInTheDocument();
  });

  it('has responsive layout', () => {
    const { container } = render(<BountyDetailPage bounty={mockBounty} />);
    // Check for responsive grid classes
    expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeInTheDocument();
  });

  it('has touch-friendly buttons (min 44px)', () => {
    render(<BountyDetailPage bounty={mockBounty} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      if (button.textContent?.includes('Claim') || button.textContent?.includes('Submit')) {
        expect(button).toHaveClass('min-h-[44px]');
      }
    });
  });
});