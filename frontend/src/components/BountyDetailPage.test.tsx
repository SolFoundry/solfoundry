import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BountyDetailPage } from './BountyDetailPage';

function renderDetail(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

const mockBounty = {
  id: 'test-bounty-1',
  title: 'Test Bounty: Sample Implementation',
  tier: 'T1' as const,
  reward: 250000,
  category: 'frontend',
  skills: ['React', 'TypeScript'],
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
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Test Bounty: Sample Implementation')).toBeInTheDocument();
  });

  it('renders tier badge', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('renders reward amount', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('250,000 FNDRY')).toBeInTheDocument();
  });

  it('renders category', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getAllByText('OPEN').length).toBeGreaterThanOrEqual(1);
  });

  it('renders description', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText(/This is a test bounty description/)).toBeInTheDocument();
  });

  it('renders description as Markdown (e.g. bold)', () => {
    renderDetail(
      <BountyDetailPage
        bounty={{
          ...mockBounty,
          description: 'Use **bold** requirements in the PR.',
        }}
      />,
    );
    const strong = document.querySelector('strong');
    expect(strong?.textContent).toBe('bold');
  });

  it('renders requirements', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Requirement 1: Implement the component')).toBeInTheDocument();
    expect(screen.getByText('Requirement 2: Add responsive design')).toBeInTheDocument();
    expect(screen.getByText('Requirement 3: Write tests')).toBeInTheDocument();
  });

  it('renders submissions section in quick stats', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('Submissions')).toBeInTheDocument();
  });

  it('renders GitHub issue link', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText(/#21 View on GitHub/)).toBeInTheDocument();
  });

  it('renders quick stats', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('Submissions')).toBeInTheDocument();
  });

  it('renders submit actions', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getAllByText('Submit PR').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Submit a Solution')).toBeInTheDocument();
  });

  it('renders activity feed', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    expect(screen.getAllByText(/testuser/).length).toBeGreaterThanOrEqual(1);
  });

  it('has responsive layout', () => {
    const { container } = renderDetail(<BountyDetailPage bounty={mockBounty} />);
    // Check for responsive grid classes
    expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeInTheDocument();
  });

  it('has touch-friendly buttons (min 44px)', () => {
    renderDetail(<BountyDetailPage bounty={mockBounty} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      if (button.textContent?.includes('Claim') || button.textContent?.includes('Submit')) {
        expect(button).toHaveClass('min-h-[44px]');
      }
    });
  });
});