/**
 * Open-source project marketplace test suite.
 * Tests GitHub repo discovery, funding goal setup, progress tracking,
 * and payment distribution to contributors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { RepoMarketplacePage } from '../pages/RepoMarketplacePage';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REPOS = [
  {
    id: 'repo-001',
    name: 'solana-pay',
    full_name: 'solana-labs/solana-pay',
    description: 'A new standard for decentralised payments',
    language: 'TypeScript',
    stars: 1200,
    forks: 340,
    github_url: 'https://github.com/solana-labs/solana-pay',
    owner_wallet: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7',
    goal_amount: 5000,
    current_amount: 3200,
    progress_pct: 64,
    contributor_count: 12,
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'repo-002',
    name: 'anchor',
    full_name: 'coral-xyz/anchor',
    description: 'Solana Sealevel Framework',
    language: 'Rust',
    stars: 3500,
    forks: 900,
    github_url: 'https://github.com/coral-xyz/anchor',
    owner_wallet: 'Bmu2YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o8',
    goal_amount: 10000,
    current_amount: 10000,
    progress_pct: 100,
    contributor_count: 28,
    created_at: '2025-02-01T00:00:00Z',
  },
  {
    id: 'repo-003',
    name: 'web3.js',
    full_name: 'solana-labs/solana-web3.js',
    description: 'Solana JavaScript SDK',
    language: 'TypeScript',
    stars: 2100,
    forks: 610,
    github_url: 'https://github.com/solana-labs/solana-web3.js',
    owner_wallet: 'Cmu3YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o9',
    goal_amount: 8000,
    current_amount: 1500,
    progress_pct: 18,
    contributor_count: 7,
    created_at: '2025-03-01T00:00:00Z',
  },
  {
    id: 'repo-004',
    name: 'spl-token',
    full_name: 'solana-labs/solana-program-library',
    description: 'Token program for the Solana blockchain',
    language: 'Rust',
    stars: 900,
    forks: 220,
    github_url: 'https://github.com/solana-labs/spl-token',
    owner_wallet: 'Dmu4YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71oa',
    goal_amount: 3000,
    current_amount: 0,
    progress_pct: 0,
    contributor_count: 0,
    created_at: '2025-04-01T00:00:00Z',
  },
];

const CONTRIBUTORS = [
  { wallet: 'Wallet111...', amount: 1500, pct: 46.9 },
  { wallet: 'Wallet222...', amount: 1000, pct: 31.2 },
  { wallet: 'Wallet333...', amount: 700, pct: 21.9 },
];

function okJson(data: unknown): Response {
  return {
    ok: true, status: 200,
    json: () => Promise.resolve(data),
  } as Response;
}

function failJson(status: number): Response {
  return {
    ok: false, status,
    json: () => Promise.resolve({ detail: 'error' }),
  } as Response;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

function renderPage() {
  return render(<RepoMarketplacePage />, { wrapper: createWrapper() });
}

function mockReposApi(repos = REPOS) {
  mockFetch.mockImplementation((urlArg: unknown) => {
    const url = String(urlArg ?? '');
    if (url.includes('/api/repos') && !url.includes('/contributors')) {
      const params = new URLSearchParams(url.split('?')[1] ?? '');
      let filtered = repos;
      const lang = params.get('language');
      const minStars = params.get('min_stars');
      if (lang) filtered = filtered.filter((r) => r.language === lang);
      if (minStars) filtered = filtered.filter((r) => r.stars >= Number(minStars));
      return Promise.resolve(okJson({ items: filtered, total: filtered.length }));
    }
    if (url.includes('/contributors')) {
      return Promise.resolve(okJson({ contributors: CONTRIBUTORS }));
    }
    return Promise.resolve(okJson({ items: [], total: 0 }));
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  mockReposApi();
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

describe('Routing', () => {
  it('renders the page heading', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: /open.source funding/i })).toBeInTheDocument();
  });

  it('renders repo grid container', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-grid')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Grid + cards
// ---------------------------------------------------------------------------

describe('Repo grid', () => {
  it('renders a card for each repo returned', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByTestId(/^repo-card-/).length).toBe(REPOS.length),
    );
  });

  it('shows repo name, language and stars on each card', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    const card = screen.getByTestId('repo-card-repo-001');
    expect(card).toHaveTextContent('solana-pay');
    expect(card).toHaveTextContent('TypeScript');
    expect(card).toHaveTextContent('1200');
  });

  it('renders funding progress bar for each card', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    expect(screen.getByTestId('progress-bar-repo-001')).toBeInTheDocument();
  });

  it('shows "Goal Met" badge when fully funded', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-002')).toBeInTheDocument());
    expect(screen.getByTestId('goal-met-repo-002')).toBeInTheDocument();
  });

  it('shows 0 % for unfunded repos', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-004')).toBeInTheDocument());
    const card = screen.getByTestId('repo-card-repo-004');
    expect(card).toHaveTextContent('0%');
  });
});

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

describe('Filters', () => {
  it('filters by language', async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((urlArg: unknown) => {
      const url = String(urlArg ?? '');
      if (url.includes('/api/repos')) {
        const params = new URLSearchParams(url.split('?')[1] ?? '');
        const lang = params.get('language');
        const filtered = lang ? REPOS.filter((r) => r.language === lang) : REPOS;
        return Promise.resolve(okJson({ items: filtered, total: filtered.length }));
      }
      return Promise.resolve(okJson({ items: [], total: 0 }));
    });

    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId(/^repo-card-/).length).toBe(4));

    await u.selectOptions(screen.getByTestId('language-filter'), 'Rust');
    await waitFor(() => expect(screen.getAllByTestId(/^repo-card-/).length).toBe(2));
  });

  it('filters by minimum stars', async () => {
    mockFetch.mockReset();
    mockFetch.mockImplementation((urlArg: unknown) => {
      const url = String(urlArg ?? '');
      if (url.includes('/api/repos')) {
        const params = new URLSearchParams(url.split('?')[1] ?? '');
        const minStars = params.get('min_stars');
        const filtered = minStars
          ? REPOS.filter((r) => r.stars >= Number(minStars))
          : REPOS;
        return Promise.resolve(okJson({ items: filtered, total: filtered.length }));
      }
      return Promise.resolve(okJson({ items: [], total: 0 }));
    });

    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByTestId(/^repo-card-/).length).toBe(4));

    await u.selectOptions(screen.getByTestId('stars-filter'), '2000');
    await waitFor(() => expect(screen.getAllByTestId(/^repo-card-/).length).toBe(2));
  });

  it('renders sort select', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('sort-select')).toBeInTheDocument());
  });

  it('shows empty state when no repos match', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue(okJson({ items: [], total: 0 }));

    renderPage();
    await waitFor(() => expect(screen.getByTestId('empty-repos')).toBeInTheDocument());
  });
});

// ---------------------------------------------------------------------------
// Detail modal
// ---------------------------------------------------------------------------

describe('Detail modal', () => {
  it('opens detail modal on card click', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());

    await u.click(screen.getByTestId('repo-card-repo-001'));
    expect(screen.getByTestId('repo-detail-modal')).toBeInTheDocument();
    expect(screen.getByTestId('detail-repo-name')).toHaveTextContent('solana-pay');
  });

  it('shows description in detail modal', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    expect(screen.getByTestId('detail-description')).toHaveTextContent(
      'A new standard for decentralised payments',
    );
  });

  it('shows funding progress in detail modal', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    expect(screen.getByTestId('detail-progress')).toBeInTheDocument();
    expect(screen.getByTestId('detail-progress')).toHaveTextContent('64%');
  });

  it('closes modal on close button', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    expect(screen.getByTestId('repo-detail-modal')).toBeInTheDocument();

    await u.click(screen.getByTestId('close-detail-modal'));
    expect(screen.queryByTestId('repo-detail-modal')).not.toBeInTheDocument();
  });

  it('shows contributor distribution in detail modal', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    await waitFor(() =>
      expect(screen.getByTestId('contributor-list')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('contributor-list')).toHaveTextContent('46.9');
  });
});

// ---------------------------------------------------------------------------
// Fund workflow
// ---------------------------------------------------------------------------

describe('Fund workflow', () => {
  it('opens fund modal from detail modal', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    await u.click(screen.getByTestId('open-fund-modal'));
    expect(screen.getByTestId('fund-modal')).toBeInTheDocument();
  });

  it('confirm-fund button is disabled until amount entered', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    await u.click(screen.getByTestId('open-fund-modal'));
    expect(screen.getByTestId('confirm-fund')).toBeDisabled();
  });

  it('confirm-fund button enables after amount entered', async () => {
    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    await u.click(screen.getByTestId('open-fund-modal'));
    await u.type(screen.getByTestId('fund-amount-input'), '100');
    expect(screen.getByTestId('confirm-fund')).not.toBeDisabled();
  });

  it('submits fund and shows success message', async () => {
    mockFetch.mockImplementation((urlArg: unknown, opts?: unknown) => {
      const url = String(urlArg ?? '');
      const method = (opts as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'POST' && url.includes('/api/repos/repo-001/fund')) {
        return Promise.resolve(
          okJson({ id: 'fund-abc', repo_id: 'repo-001', amount: 100, tx_signature: 'sig123' }),
        );
      }
      if (url.includes('/api/repos') && !url.includes('/contributors')) {
        return Promise.resolve(okJson({ items: REPOS, total: REPOS.length }));
      }
      if (url.includes('/contributors')) {
        return Promise.resolve(okJson({ contributors: CONTRIBUTORS }));
      }
      return Promise.resolve(okJson({ items: [], total: 0 }));
    });

    const u = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('repo-card-repo-001')).toBeInTheDocument());
    await u.click(screen.getByTestId('repo-card-repo-001'));
    await u.click(screen.getByTestId('open-fund-modal'));
    await u.type(screen.getByTestId('fund-amount-input'), '100');
    await u.click(screen.getByTestId('confirm-fund'));

    await waitFor(() =>
      expect(screen.getByTestId('fund-success')).toBeInTheDocument(),
    );
  });
});

// ---------------------------------------------------------------------------
// Register repo (funding goal setup)
// ---------------------------------------------------------------------------

describe('Register repo', () => {
  it('opens register modal on button click', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByTestId('register-repo-btn'));
    expect(screen.getByTestId('register-modal')).toBeInTheDocument();
  });

  it('submit is disabled until required fields filled', async () => {
    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByTestId('register-repo-btn'));
    expect(screen.getByTestId('submit-register')).toBeDisabled();
  });

  it('submits registration and closes modal on success', async () => {
    const newRepo = { ...REPOS[0], id: 'repo-new', name: 'my-new-repo' };
    mockFetch.mockImplementation((urlArg: unknown, opts?: unknown) => {
      const url = String(urlArg ?? '');
      const method = (opts as RequestInit | undefined)?.method ?? 'GET';
      if (method === 'POST' && url.includes('/api/repos')) {
        return Promise.resolve(okJson(newRepo));
      }
      if (url.includes('/api/repos')) {
        return Promise.resolve(okJson({ items: REPOS, total: REPOS.length }));
      }
      if (url.includes('/contributors')) {
        return Promise.resolve(okJson({ contributors: CONTRIBUTORS }));
      }
      return Promise.resolve(okJson({ items: [], total: 0 }));
    });

    const u = userEvent.setup();
    renderPage();
    await u.click(screen.getByTestId('register-repo-btn'));

    await u.type(screen.getByTestId('register-github-url'), 'https://github.com/me/my-new-repo');
    await u.type(screen.getByTestId('register-goal-amount'), '5000');
    await u.type(screen.getByTestId('register-owner-wallet'), 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7');

    expect(screen.getByTestId('submit-register')).not.toBeDisabled();
    await u.click(screen.getByTestId('submit-register'));

    await waitFor(() =>
      expect(screen.queryByTestId('register-modal')).not.toBeInTheDocument(),
    );
  });
});
