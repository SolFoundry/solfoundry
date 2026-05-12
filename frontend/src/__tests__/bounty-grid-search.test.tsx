import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BountyGrid } from '../components/bounty/BountyGrid';
import { useInfiniteBounties } from '../hooks/useBounties';
import type { Bounty } from '../types/bounty';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      animate,
      exit,
      initial,
      layout,
      transition,
      variants,
      viewport,
      whileHover,
      whileInView,
      whileTap,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: vi.fn(),
}));

const baseBounty = {
  status: 'open',
  tier: 'T1',
  reward_amount: 100_000,
  reward_token: 'FNDRY',
  submission_count: 0,
  created_at: '2026-05-01T00:00:00.000Z',
  github_issue_url: 'https://github.com/SolFoundry/solfoundry/issues/1',
} satisfies Partial<Bounty>;

function bounty(overrides: Partial<Bounty>): Bounty {
  return {
    ...baseBounty,
    id: overrides.id ?? 'bounty-id',
    title: overrides.title ?? 'Bounty title',
    description: overrides.description ?? 'Bounty description',
    skills: overrides.skills ?? [],
    ...overrides,
  } as Bounty;
}

describe('BountyGrid search', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useInfiniteBounties).mockReturnValue({
      data: {
        pages: [
          {
            items: [
              bounty({
                id: 'react',
                title: 'Add toast notification system',
                description: 'Build a reusable UI toast component.',
                skills: ['React', 'TypeScript'],
              }),
              bounty({
                id: 'rust',
                title: 'Optimize Rust verifier',
                description: 'Improve backend proof validation.',
                skills: ['Rust'],
              }),
            ],
            total: 2,
            limit: 12,
            offset: 0,
          },
        ],
        pageParams: [0],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useInfiniteBounties>);
  });

  it('filters bounty cards by debounced title, description, and skills search', () => {
    render(
      <MemoryRouter>
        <BountyGrid />
      </MemoryRouter>,
    );

    expect(screen.getByText('Add toast notification system')).toBeInTheDocument();
    expect(screen.getByText('Optimize Rust verifier')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search bounties'), {
      target: { value: 'rust' },
    });
    act(() => vi.advanceTimersByTime(250));

    expect(screen.getByText('Optimize Rust verifier')).toBeInTheDocument();
    expect(screen.queryByText('Add toast notification system')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('Add toast notification system')).toBeInTheDocument();
    expect(screen.getByText('Optimize Rust verifier')).toBeInTheDocument();
  });
});
