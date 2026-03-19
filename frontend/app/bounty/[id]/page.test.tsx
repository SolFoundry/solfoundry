import { render, screen } from '@testing-library/react';
import BountyDetailPage from './page';

// Mock useCountdown to avoid timer issues in tests
jest.mock('react', () => {
  const actualReact = jest.requireActual('react');
  return {
    ...actualReact,
    useState: (initial: unknown) => [initial, jest.fn()],
    useEffect: jest.fn((fn) => fn()),
  };
});

describe('BountyDetailPage', () => {
  it('renders bounty title', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText(/Bounty T1: Bounty Detail Page/)).toBeInTheDocument();
  });

  it('renders tier badge', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('renders reward amount', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText(/200,000 FNDRY/)).toBeInTheDocument();
  });

  it('renders category tag', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('renders requirements checklist', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText(/responsive layout/)).toBeInTheDocument();
    expect(screen.getByText(/countdown timer/)).toBeInTheDocument();
  });

  it('renders submissions section', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('Submissions')).toBeInTheDocument();
    expect(screen.getByText(/devmaster42/)).toBeInTheDocument();
  });

  it('renders activity feed', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    expect(screen.getByText(/claimed this bounty/)).toBeInTheDocument();
  });

  it('renders quick stats', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    expect(screen.getByText(/Views/)).toBeInTheDocument();
  });

  it('renders GitHub issue button', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('View GitHub Issue')).toBeInTheDocument();
  });

  it('renders claimed by info', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText(/claimed by:/)).toBeInTheDocument();
  });

  it('renders Submit PR button when claimed', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('Submit PR')).toBeInTheDocument();
  });

  it('renders skills section', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText('Required Skills')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
  });

  it('renders back link', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText(/Back to Bounties/)).toBeInTheDocument();
  });

  it('renders markdown description', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText(/Overview/)).toBeInTheDocument();
    expect(screen.getByText(/UI\/UX Requirements/)).toBeInTheDocument();
  });

  it('renders time remaining section', () => {
    render(<BountyDetailPage params={{ id: '21' }} />);
    expect(screen.getByText(/Time Remaining/)).toBeInTheDocument();
  });
});
