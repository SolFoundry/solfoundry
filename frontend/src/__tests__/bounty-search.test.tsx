import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BountyGrid } from '../components/bounty/BountyGrid';

const useInfiniteBountiesMock = vi.fn();

vi.mock('../hooks/useBounties', () => ({
  useInfiniteBounties: (...args: unknown[]) => useInfiniteBountiesMock(...args),
}));

vi.mock('../components/bounty/BountyCard', () => ({
  BountyCard: ({ bounty }: { bounty: { title: string } }) => <div>{bounty.title}</div>,
}));

function renderGrid() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <BountyGrid />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('BountyGrid search', () => {
  beforeEach(() => {
    useInfiniteBountiesMock.mockReturnValue({
      data: { pages: [{ items: [{ id: '1', title: 'Toast task' }], total: 1 }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    useInfiniteBountiesMock.mockReset();
  });

  it('debounces search and passes it to the bounty query params', async () => {
    renderGrid();

    expect(useInfiniteBountiesMock).toHaveBeenLastCalledWith({
      status: 'open',
      skill: undefined,
      search: undefined,
    });

    fireEvent.change(screen.getByLabelText('Search bounties'), { target: { value: 'toast' } });

    await waitFor(
      () => {
        expect(useInfiniteBountiesMock).toHaveBeenLastCalledWith({
          status: 'open',
          skill: undefined,
          search: 'toast',
        });
      },
      { timeout: 1200 },
    );
  });

  it('clears the search input with the clear button', async () => {
    renderGrid();

    const input = screen.getByLabelText('Search bounties') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'timer' } });
    expect(input.value).toBe('timer');

    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(input.value).toBe('');

    await waitFor(
      () => {
        expect(useInfiniteBountiesMock).toHaveBeenLastCalledWith({
          status: 'open',
          skill: undefined,
          search: undefined,
        });
      },
      { timeout: 1200 },
    );
  });
});
