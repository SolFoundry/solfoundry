import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityFeed } from '../components/home/ActivityFeed';

const useActivityMock = vi.fn();

vi.mock('../hooks/useActivity', () => ({
  useActivity: () => useActivityMock(),
}));

vi.mock('../lib/animations', () => ({
  slideInRight: { initial: {}, animate: {} },
}));

describe('home activity feed', () => {
  beforeEach(() => {
    useActivityMock.mockReset();
  });

  it('renders real activity events from the hook', () => {
    useActivityMock.mockReturnValue({
      data: [
        {
          id: 'evt-1',
          type: 'submitted',
          username: 'alice',
          detail: 'PR to Bounty #12',
          timestamp: new Date().toISOString(),
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<ActivityFeed />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText(/PR to Bounty #12/)).toBeInTheDocument();
  });

  it('shows no recent activity state when API returns empty', () => {
    useActivityMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<ActivityFeed />);
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('falls back gracefully when API is unavailable', () => {
    useActivityMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<ActivityFeed />);
    expect(screen.getByText(/showing fallback activity/i)).toBeInTheDocument();
  });
});
