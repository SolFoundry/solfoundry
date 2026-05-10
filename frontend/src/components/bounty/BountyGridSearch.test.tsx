import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BountyGrid } from './BountyGrid';
import { listBounties } from '../../api/bounties';

vi.mock('../../api/bounties', () => ({
  listBounties: vi.fn(),
}));

const mockedListBounties = vi.mocked(listBounties);

function renderGrid() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

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
    vi.useFakeTimers();
    mockedListBounties.mockReset();
    mockedListBounties.mockResolvedValue({ items: [], total: 0, limit: 12, offset: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search and sends it with the existing bounty filters', () => {
    renderGrid();

    fireEvent.change(screen.getByPlaceholderText(/search bounties/i), { target: { value: 'rust' } });

    expect(mockedListBounties).toHaveBeenCalledWith(expect.not.objectContaining({ search: 'rust' }));

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(mockedListBounties).toHaveBeenLastCalledWith(expect.objectContaining({
      status: 'open',
      search: 'rust',
    }));
  });

  it('clears the search query without changing other filters', () => {
    renderGrid();

    fireEvent.click(screen.getByText('TypeScript'));
    fireEvent.change(screen.getByPlaceholderText(/search bounties/i), { target: { value: 'api' } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    fireEvent.click(screen.getByLabelText(/clear search/i));

    expect(screen.getByPlaceholderText(/search bounties/i)).toHaveValue('');
    expect(screen.getByText('TypeScript')).toHaveClass('bg-forge-700');
    expect(mockedListBounties).toHaveBeenCalledWith(expect.objectContaining({
      status: 'open',
      skill: 'TypeScript',
      search: undefined,
    }));
  });
});
