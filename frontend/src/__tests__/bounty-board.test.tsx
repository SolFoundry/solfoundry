/**
 * Bounty board test suite.
 * Tests for BountyCard, EmptyState, useBountyBoard hook, BountyBoard component,
 * and pagination controls including URL sync and keyboard navigation.
 * All components using React Query are wrapped in QueryClientProvider.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import BountiesPage from '../pages/BountiesPage';
import { BountyBoard } from '../components/bounties/BountyBoard';
import { BountyCard, formatTimeRemaining, formatReward } from '../components/bounties/BountyCard';
import { EmptyState } from '../components/bounties/EmptyState';
import { Pagination } from '../components/bounties/Pagination';
import { useBountyBoard, PER_PAGE } from '../hooks/useBountyBoard';
import { mockBounties } from '../data/mockBounties';
import type { Bounty } from '../types/bounty';
import React from 'react';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Successful fetch response helper. */
function okJson(data: unknown): Response {
  return {
    ok: true, status: 200, statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

/** Failed fetch response helper. */
function failJson(status: number): Response {
  return {
    ok: false, status, statusText: 'Error',
    json: () => Promise.resolve({ message: 'error' }),
    headers: new Headers(), redirected: false, type: 'basic' as ResponseType, url: '',
    clone: function () { return this; }, body: null, bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve('{"message":"error"}'),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

beforeEach(() => mockFetch.mockReset());

/** Create a QueryClient + MemoryRouter wrapper for hooks and components. */
function createQueryWrapper(initialEntries?: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries ?? ['/bounties']}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

/** Render a component inside MemoryRouter. */
function renderWithRouter(ui: React.ReactElement, initialEntries?: string[]) {
  return render(ui, { wrapper: createQueryWrapper(initialEntries) });
}

const testBounty: Bounty = {
  id: 't1', title: 'Test', description: 'D', tier: 'T2',
  skills: ['React', 'TS', 'Rust', 'Sol'], rewardAmount: 3500,
  currency: 'USDC', deadline: new Date(Date.now() + 5 * 864e5).toISOString(),
  status: 'open', submissionCount: 3, createdAt: new Date().toISOString(), projectName: 'TP',
  creatorType: 'community',
};

const b: Bounty = testBounty;

/** Mock API responses so React Query resolves for BountyBoard tests. */
function mockBountyApis(items: Bounty[] = mockBounties) {
  const apiItems = items.map(b => ({ ...b, reward_amount: b.rewardAmount, required_skills: b.skills, created_at: b.createdAt, submission_count: b.submissionCount, creator_type: b.creatorType }));
  mockFetch.mockImplementation((...args: unknown[]) => {
    const url = String(args[0] ?? '');
    if (url.includes('/api/bounties/search')) {
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      const page = Number(params.get('page') ?? 1);
      const perPage = Number(params.get('per_page') ?? 12);
      const start = (page - 1) * perPage;
      const paged = apiItems.slice(start, start + perPage);
      return Promise.resolve(okJson({ items: paged, total: apiItems.length }));
    }
    if (url.includes('/api/bounties/hot')) return Promise.resolve(okJson([]));
    if (url.includes('/api/bounties/recommended')) return Promise.resolve(okJson([]));
    return Promise.resolve(okJson([]));
  });
}

describe('Page+Board', () => {
  beforeEach(() => mockBountyApis());

  it('renders BountyBoard with heading', () => {
    renderWithRouter(<BountiesPage />);
    expect(screen.getByText('Bounty Marketplace')).toBeInTheDocument();
  });
  it('renders all cards with filters', async () => {
    renderWithRouter(<BountyBoard />);
    expect(screen.getByText('Bounty Marketplace')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(screen.getByTestId('bounty-grid')).getAllByTestId(/^bounty-card-/).length).toBe(mockBounties.length);
    });
  });
  it('filters by tier and resets', async () => {
    // Dynamic mock: check URL for tier param and return filtered results
    const toApi = (b: Bounty) => ({ ...b, reward_amount: b.rewardAmount, required_skills: b.skills, created_at: b.createdAt, submission_count: b.submissionCount, creator_type: b.creatorType });
    const TIER_NUM: Record<string, string> = { T1: '1', T2: '2', T3: '3' };
    mockFetch.mockImplementation((...args: unknown[]) => {
      const url = String(args[0] ?? '');
      if (url.includes('/api/bounties/search')) {
        const tierMatch = url.match(/tier=(\d)/);
        const items = tierMatch
          ? mockBounties.filter(b => TIER_NUM[b.tier] === tierMatch[1])
          : mockBounties;
        return Promise.resolve(okJson({ items: items.map(toApi), total: items.length }));
      }
      return Promise.resolve(okJson([]));
    });
    const u = userEvent.setup();
    renderWithRouter(<BountyBoard />);
    await waitFor(() => { expect(screen.getByTestId('bounty-grid')).toBeInTheDocument(); });
    await u.click(screen.getByTestId('tier-chip-T1'));
    const t1 = mockBounties.filter(x => x.tier === 'T1');
    await waitFor(() => {
      expect(screen.getAllByTestId(/^bounty-card-/).length).toBe(t1.length);
    });
    await u.click(screen.getByTestId('reset-filters'));
    await waitFor(() => {
      expect(screen.getAllByTestId(/^bounty-card-/).length).toBe(mockBounties.length);
    });
  });
  it('has create bounty button', () => {
    renderWithRouter(<BountyBoard />);
    const btn = screen.getByTestId('create-bounty-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('href', '/bounties/create');
  });
  it('has view toggle (grid/list)', () => {
    renderWithRouter(<BountyBoard />);
    expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('view-grid')).toBeInTheDocument();
    expect(screen.getByTestId('view-list')).toBeInTheDocument();
  });
  it('switches between grid and list view', async () => {
    const u = userEvent.setup();
    renderWithRouter(<BountyBoard />);
    await waitFor(() => { expect(screen.getByTestId('bounty-grid')).toBeInTheDocument(); });
    await u.click(screen.getByTestId('view-list'));
    expect(screen.getByTestId('bounty-list')).toBeInTheDocument();
    expect(screen.queryByTestId('bounty-grid')).not.toBeInTheDocument();
    await u.click(screen.getByTestId('view-grid'));
    expect(screen.getByTestId('bounty-grid')).toBeInTheDocument();
  });
});

describe('BountyCard', () => {
  it('renders info and handles click', async () => {
    const handleClick = vi.fn();
    render(<BountyCard bounty={testBounty} onClick={handleClick} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('3.5k')).toBeInTheDocument();
    expect(screen.getByText('T2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /test/i }));
    expect(handleClick).toHaveBeenCalledWith('t1');
  });

  it('expired shows text, urgent shows indicator testid', () => {
    const { rerender } = render(
      <BountyCard bounty={{ ...testBounty, deadline: new Date(Date.now() - 1000).toISOString() }} onClick={() => {}} />,
    );
    expect(screen.getByText('Expired')).toBeInTheDocument();
    rerender(
      <BountyCard bounty={{ ...testBounty, deadline: new Date(Date.now() + 12 * 36e5).toISOString() }} onClick={() => {}} />,
    );
    expect(screen.getByTestId('urgent-indicator')).toBeInTheDocument();
  });
  it('shows community badge for community bounty', () => {
    render(<BountyCard bounty={{...b, creatorType: 'community'}} onClick={()=>{}} />);
    expect(screen.getByTestId('creator-badge-community')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
  });
  it('shows platform badge for platform bounty', () => {
    render(<BountyCard bounty={{...b, creatorType: 'platform'}} onClick={()=>{}} />);
    expect(screen.getByTestId('creator-badge-platform')).toBeInTheDocument();
    expect(screen.getByText('Official')).toBeInTheDocument();
  });
  it('shows submission count for all tiers', () => {
    render(<BountyCard bounty={{...b, tier: 'T1', submissionCount: 5}} onClick={()=>{}} />);
    expect(screen.getByText('5 submissions')).toBeInTheDocument();
  });
});

describe('Helpers + components', () => {
  it('formatTimeRemaining and formatReward', () => {
    expect(formatTimeRemaining(new Date(Date.now() - 1000).toISOString())).toBe('Expired');
    expect(formatReward(3500)).toBe('3.5k');
    expect(formatReward(350)).toBe('350');
  });

  it('BountyCard shows status indicator', () => {
    render(<BountyCard bounty={testBounty} onClick={() => {}} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('EmptyState renders with reset button', async () => {
    const handleReset = vi.fn();
    render(<EmptyState onReset={handleReset} />);
    await userEvent.click(screen.getByRole('button', { name: /clear all filters/i }));
    expect(handleReset).toHaveBeenCalledOnce();
  });
});

describe('useBountyBoard with React Query', () => {
  it('fetches bounties from the API and returns them', async () => {
    const apiBounties = mockBounties.map(bounty => ({
      id: bounty.id, title: bounty.title, description: bounty.description,
      tier: bounty.tier === 'T1' ? 1 : bounty.tier === 'T2' ? 2 : 3,
      required_skills: bounty.skills, reward_amount: bounty.rewardAmount,
      deadline: bounty.deadline, status: bounty.status.replace('-', '_'),
      submission_count: bounty.submissionCount, created_at: bounty.createdAt,
      created_by: bounty.projectName,
    }));

    mockFetch.mockImplementation((urlArg: unknown) => {
      const url = String(urlArg ?? '');
      if (url.includes('/search')) {
        return Promise.resolve(okJson({ items: apiBounties, total: apiBounties.length, page: 1, per_page: PER_PAGE, query: '' }));
      }
      if (url.includes('/hot')) return Promise.resolve(okJson([]));
      if (url.includes('/recommended')) return Promise.resolve(okJson([]));
      return Promise.resolve(okJson({ items: apiBounties }));
    });

    const { result } = renderHook(() => useBountyBoard(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.bounties.length).toBeGreaterThan(0);
  });

  it('handles API failure gracefully with empty results', async () => {
    mockFetch.mockResolvedValue(failJson(404));

    const { result } = renderHook(() => useBountyBoard(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(Array.isArray(result.current.bounties)).toBe(true);
  });

  it('supports sort and filter state changes', async () => {
    mockFetch.mockResolvedValue(okJson({ items: [], total: 0, page: 1, per_page: PER_PAGE, query: '' }));

    const { result } = renderHook(() => useBountyBoard(), { wrapper: createQueryWrapper() });

    act(() => { result.current.setFilter('tier', 'T1'); });
    expect(result.current.filters.tier).toBe('T1');

    act(() => { result.current.setSortBy('reward_high'); });
    expect(result.current.sortBy).toBe('reward_high');

    act(() => { result.current.resetFilters(); });
    expect(result.current.filters.tier).toBe('all');
  });

  it('reads page from URL search params', async () => {
    mockFetch.mockResolvedValue(okJson({ items: [], total: 24, page: 2, per_page: PER_PAGE, query: '' }));

    const { result } = renderHook(() => useBountyBoard(), {
      wrapper: createQueryWrapper(['/bounties?page=2']),
    });

    expect(result.current.page).toBe(2);
  });

  it('reads sort from URL search params', async () => {
    mockFetch.mockResolvedValue(okJson({ items: [], total: 0, page: 1, per_page: PER_PAGE, query: '' }));

    const { result } = renderHook(() => useBountyBoard(), {
      wrapper: createQueryWrapper(['/bounties?sort=reward_high']),
    });

    expect(result.current.sortBy).toBe('reward_high');
  });

  it('defaults invalid page param to 1', async () => {
    mockFetch.mockResolvedValue(okJson({ items: [], total: 0, page: 1, per_page: PER_PAGE, query: '' }));

    const { result } = renderHook(() => useBountyBoard(), {
      wrapper: createQueryWrapper(['/bounties?page=abc']),
    });

    expect(result.current.page).toBe(1);
  });

  it('defaults invalid sort param to newest', async () => {
    mockFetch.mockResolvedValue(okJson({ items: [], total: 0, page: 1, per_page: PER_PAGE, query: '' }));

    const { result } = renderHook(() => useBountyBoard(), {
      wrapper: createQueryWrapper(['/bounties?sort=invalid']),
    });

    expect(result.current.sortBy).toBe('newest');
  });

  it('resets page to 1 when filter changes', async () => {
    mockFetch.mockResolvedValue(okJson({ items: [], total: 30, page: 1, per_page: PER_PAGE, query: '' }));

    const { result } = renderHook(() => useBountyBoard(), {
      wrapper: createQueryWrapper(['/bounties?page=3']),
    });

    expect(result.current.page).toBe(3);

    act(() => { result.current.setFilter('tier', 'T1'); });
    expect(result.current.page).toBe(1);
  });

  it('uses 12 items per page', () => {
    expect(PER_PAGE).toBe(12);
  });
});

describe('Pagination component', () => {
  it('renders page metadata', () => {
    render(<Pagination page={2} totalPages={5} total={54} onPageChange={() => {}} />);
    expect(screen.getByTestId('page-metadata')).toHaveTextContent('Page 2 of 5 (54 bounties)');
  });

  it('renders singular "bounty" for total=1', () => {
    render(<Pagination page={1} totalPages={1} total={1} onPageChange={() => {}} />);
    expect(screen.getByTestId('page-metadata')).toHaveTextContent('1 bounty');
  });

  it('disables Prev on first page', () => {
    render(<Pagination page={1} totalPages={3} total={30} onPageChange={() => {}} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(<Pagination page={3} totalPages={3} total={30} onPageChange={() => {}} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('highlights the active page', () => {
    render(<Pagination page={2} totalPages={5} total={54} onPageChange={() => {}} />);
    expect(screen.getByLabelText('Page 2')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('Page 1')).not.toHaveAttribute('aria-current');
  });

  it('calls onPageChange when clicking Prev/Next', async () => {
    const onPageChange = vi.fn();
    const u = userEvent.setup();
    render(<Pagination page={2} totalPages={5} total={54} onPageChange={onPageChange} />);

    await u.click(screen.getByLabelText('Previous page'));
    expect(onPageChange).toHaveBeenCalledWith(1);

    await u.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('calls onPageChange when clicking page number', async () => {
    const onPageChange = vi.fn();
    const u = userEvent.setup();
    render(<Pagination page={1} totalPages={5} total={54} onPageChange={onPageChange} />);

    await u.click(screen.getByLabelText('Page 3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('shows go-to-page input when totalPages > 5', () => {
    render(<Pagination page={1} totalPages={10} total={120} onPageChange={() => {}} />);
    expect(screen.getByTestId('go-to-page')).toBeInTheDocument();
  });

  it('does not show go-to-page input when totalPages <= 5', () => {
    render(<Pagination page={1} totalPages={5} total={54} onPageChange={() => {}} />);
    expect(screen.queryByTestId('go-to-page')).not.toBeInTheDocument();
  });

  it('go-to-page navigates on Enter', async () => {
    const onPageChange = vi.fn();
    const u = userEvent.setup();
    render(<Pagination page={1} totalPages={10} total={120} onPageChange={onPageChange} />);

    const input = screen.getByTestId('go-to-page-input');
    await u.type(input, '7');
    await u.keyboard('{Enter}');
    expect(onPageChange).toHaveBeenCalledWith(7);
  });

  it('go-to-page rejects invalid input', async () => {
    const onPageChange = vi.fn();
    const u = userEvent.setup();
    render(<Pagination page={1} totalPages={10} total={120} onPageChange={onPageChange} />);

    const input = screen.getByTestId('go-to-page-input');
    await u.type(input, '99');
    await u.keyboard('{Enter}');
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

describe('Keyboard navigation', () => {
  beforeEach(() => {
    mockBountyApis();
    // jsdom doesn't implement scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('ArrowRight advances page via BountyBoard', async () => {
    // Need >1 page so pagination renders and arrow keys work
    const many = Array.from({ length: 24 }, (_, i) => ({
      ...mockBounties[0],
      id: `kb-${i}`,
      title: `KB Bounty ${i}`,
    }));
    mockBountyApis(many);

    renderWithRouter(<BountyBoard />);
    await waitFor(() => { expect(screen.getByTestId('bounty-grid')).toBeInTheDocument(); });

    // Page 1 initially — ArrowRight should navigate to page 2
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByTestId('page-metadata')).toHaveTextContent('Page 2 of 2');
    });

    // ArrowLeft should go back to page 1
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByTestId('page-metadata')).toHaveTextContent('Page 1 of 2');
    });
  });

  it('arrow keys are ignored when typing in an input', async () => {
    const many = Array.from({ length: 24 }, (_, i) => ({
      ...mockBounties[0],
      id: `kb-${i}`,
      title: `KB Bounty ${i}`,
    }));
    mockBountyApis(many);

    renderWithRouter(<BountyBoard />);
    await waitFor(() => { expect(screen.getByTestId('bounty-grid')).toBeInTheDocument(); });

    // Focus the search input and press ArrowRight — page should NOT change
    const searchInput = screen.getByPlaceholderText(/search/i);
    searchInput.focus();
    fireEvent.keyDown(searchInput, { key: 'ArrowRight' });
    expect(screen.getByTestId('page-metadata')).toHaveTextContent('Page 1 of 2');
  });
});

describe('BountyBoard pagination integration', () => {
  it('sends per_page=12 in API requests', async () => {
    mockFetch.mockImplementation((urlArg: unknown) => {
      const url = String(urlArg ?? '');
      if (url.includes('/search')) {
        return Promise.resolve(okJson({ items: [], total: 0, page: 1, per_page: 12, query: '' }));
      }
      if (url.includes('/hot')) return Promise.resolve(okJson([]));
      if (url.includes('/recommended')) return Promise.resolve(okJson([]));
      return Promise.resolve(okJson({ items: [] }));
    });

    const { result } = renderHook(() => useBountyBoard(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const searchCall = mockFetch.mock.calls.find(([url]: [unknown]) => String(url).includes('/search'));
    expect(searchCall).toBeDefined();
    const searchUrl = String(searchCall![0]);
    expect(searchUrl).toContain('per_page=12');
  });
});
