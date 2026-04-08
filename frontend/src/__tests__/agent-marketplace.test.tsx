/** Agent marketplace — API-mocked grid, filters, modals, leaderboard. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentMarketplacePage } from '../pages/AgentMarketplacePage';

const mockAgents = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    name: 'AuditBot-7',
    role: 'security-analyst',
    capabilities: ['Contract auditing', 'Vuln detection'],
    is_active: true,
    availability: 'available',
    operator_wallet: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7',
    verified: true,
    reputation_score: 120,
    success_rate: 96,
    bounties_completed: 42,
    api_endpoint: 'https://audit.example.com',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    name: 'DevAgent-X',
    role: 'smart-contract-engineer',
    capabilities: ['Solana dev', 'Testing'],
    is_active: true,
    availability: 'available',
    operator_wallet: '9WzDXwBbmkg8ZTbNMqUxHcCQYx5LN9CsDeKwjLzRJmHX',
    verified: false,
    reputation_score: 80,
    success_rate: 91,
    bounties_completed: 38,
    api_endpoint: null,
    created_at: '2025-01-02T00:00:00Z',
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    name: 'ResearchAI',
    role: 'ai-engineer',
    capabilities: ['Protocol analysis'],
    is_active: true,
    availability: 'busy',
    operator_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    verified: false,
    reputation_score: 50,
    success_rate: 88,
    bounties_completed: 27,
    api_endpoint: null,
    created_at: '2025-01-03T00:00:00Z',
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    name: 'CodeScout',
    role: 'backend-engineer',
    capabilities: ['API'],
    is_active: false,
    availability: 'offline',
    operator_wallet: 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7',
    verified: false,
    reputation_score: 10,
    success_rate: 85,
    bounties_completed: 19,
    api_endpoint: null,
    created_at: '2025-01-04T00:00:00Z',
  },
  {
    id: 'a5555555-5555-5555-5555-555555555555',
    name: 'OptiMax',
    role: 'systems-engineer',
    capabilities: ['CU reduction'],
    is_active: true,
    availability: 'available',
    operator_wallet: '9WzDXwBbmkg8ZTbNMqUxHcCQYx5LN9CsDeKwjLzRJmHX',
    verified: false,
    reputation_score: 90,
    success_rate: 94,
    bounties_completed: 31,
    api_endpoint: null,
    created_at: '2025-01-05T00:00:00Z',
  },
  {
    id: 'a6666666-6666-6666-6666-666666666666',
    name: 'SecureAI',
    role: 'security-analyst',
    capabilities: ['Verification'],
    is_active: true,
    availability: 'available',
    operator_wallet: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    verified: false,
    reputation_score: 88,
    success_rate: 92,
    bounties_completed: 35,
    api_endpoint: null,
    created_at: '2025-01-06T00:00:00Z',
  },
];

const leaderboardItems = mockAgents
  .filter((a) => a.is_active)
  .map((a, i) => ({
    rank: i + 1,
    id: a.id,
    name: a.name,
    role: a.role,
    reputation_score: a.reputation_score,
    success_rate: a.success_rate,
    bounties_completed: a.bounties_completed,
    verified: a.verified,
    availability: a.availability,
  }));

const jsonHeaders = { 'Content-Type': 'application/json' };

function filterAgentsFromSearch(url: string): typeof mockAgents {
  const u = new URL(url);
  let items = [...mockAgents];
  const role = u.searchParams.get('role');
  if (role) items = items.filter((a) => a.role === role);
  const av = u.searchParams.get('available');
  if (av === 'true') items = items.filter((a) => a.is_active && a.availability === 'available');
  return items;
}

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.url;
      const path = new URL(url).pathname;
      if (path === '/api/agents/leaderboard') {
        return new Response(JSON.stringify({ items: leaderboardItems }), { status: 200, headers: jsonHeaders });
      }
      if (path === '/api/agents') {
        const items = filterAgentsFromSearch(url);
        return new Response(
          JSON.stringify({ items, total: items.length, page: 1, limit: 80 }),
          { status: 200, headers: jsonHeaders },
        );
      }
      if (path === '/api/bounties') {
        return new Response(
          JSON.stringify({ items: [{ id: 'b1', title: 'Fix staking (#101)' }] }),
          { status: 200, headers: jsonHeaders },
        );
      }
      return new Response('Not found', { status: 404 });
    }),
  );
}

function renderMarketplace(at = '/agents') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path="/agents" element={<AgentMarketplacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const g = (id: string) => screen.getByTestId(id);
const q = (id: string) => screen.queryByTestId(id);

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Routing', () => {
  it('renders marketplace at /agents', async () => {
    renderMarketplace('/agents');
    await waitFor(() => {
      expect(q('agents-loading')).not.toBeInTheDocument();
    });
    expect(g('marketplace-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /agent marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole('main', { name: /agent marketplace content/i })).toBeInTheDocument();
  });

  it('not mounted at /x', () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/x']}>
          <Routes>
            <Route path="/agents" element={<AgentMarketplacePage />} />
            <Route path="*" element={<div>404</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(q('marketplace-page')).not.toBeInTheDocument();
  });
});

describe('Grid', () => {
  it('cards with name, rate, bounties, statuses, CTA', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    expect(within(g('agent-grid')).getAllByTestId(/^agent-card-/).length).toBe(6);
    expect(within(g('agent-grid')).getByText('AuditBot-7')).toBeInTheDocument();
    expect(screen.getAllByText('96%').length).toBeGreaterThan(0);
    expect(screen.getByText(/Bounties completed: 42/)).toBeInTheDocument();
    expect(screen.getAllByTestId('status-available').length).toBeGreaterThan(0);
    expect(g('status-working')).toBeInTheDocument();
    expect(g('status-offline')).toBeInTheDocument();
    expect(g('register-cta')).toBeInTheDocument();
    expect(g('agent-leaderboard')).toBeInTheDocument();
  });
});

describe('Filters', () => {
  it('by role', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    await userEvent.selectOptions(g('role-filter'), 'security-analyst');
    await waitFor(() => {
      expect(within(g('agent-grid')).getAllByTestId(/^agent-card-/).length).toBe(2);
    });
    expect(within(g('agent-grid')).getByText('AuditBot-7')).toBeInTheDocument();
    expect(within(g('agent-grid')).queryByText('DevAgent-X')).not.toBeInTheDocument();
  });

  it('by rate', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    await userEvent.selectOptions(g('rate-filter'), '95');
    expect(screen.getAllByTestId(/^agent-card-/).length).toBe(1);
  });

  it('by avail', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    await userEvent.click(g('avail-filter'));
    expect(q('CodeScout')).not.toBeInTheDocument();
  });

  it('empty state', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    await userEvent.selectOptions(g('rate-filter'), '95');
    await userEvent.selectOptions(g('role-filter'), 'ai-engineer');
    await waitFor(() => {
      expect(g('empty-state')).toHaveTextContent(/No agents match/);
    });
  });
});

describe('Detail modal', () => {
  it('shows info and closes', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    await userEvent.click(g('detail-btn-a1111111-1111-1111-1111-111111111111'));
    const m = g('detail-modal');
    expect(within(m).getByText('AuditBot-7')).toBeInTheDocument();
    expect(within(m).getByText(/Contract auditing/)).toBeInTheDocument();
    expect(within(m).getByRole('progressbar')).toBeInTheDocument();
    await userEvent.click(g('close-modal'));
    expect(q('detail-modal')).not.toBeInTheDocument();
  });
});

describe('Hire', () => {
  it('full flow: select, confirm, status updated', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    await userEvent.click(g('hire-btn-a1111111-1111-1111-1111-111111111111'));
    expect(within(g('hire-modal')).getByText(/Assign AuditBot-7/)).toBeInTheDocument();
    expect(g('confirm-hire')).toBeDisabled();
    await userEvent.selectOptions(g('bounty-select'), 'b1');
    expect(g('confirm-hire')).not.toBeDisabled();
    await userEvent.click(g('confirm-hire'));
    expect(q('hire-modal')).not.toBeInTheDocument();
    expect(g('hired-label-a1111111-1111-1111-1111-111111111111')).toHaveTextContent('Fix staking');
    expect(q('hire-btn-a1111111-1111-1111-1111-111111111111')).not.toBeInTheDocument();
  });

  it('cancel', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    await userEvent.click(g('hire-btn-a2222222-2222-2222-2222-222222222222'));
    await userEvent.click(g('cancel-hire'));
    expect(q('hire-modal')).not.toBeInTheDocument();
    expect(g('hire-btn-a2222222-2222-2222-2222-222222222222')).toBeInTheDocument();
  });

  it('no hire for offline', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    expect(q('hire-btn-a4444444-4444-4444-4444-444444444444')).not.toBeInTheDocument();
  });
});

describe('Compare', () => {
  it('panel at 2+, remove, max 3', async () => {
    renderMarketplace();
    await waitFor(() => expect(q('agents-loading')).not.toBeInTheDocument());
    expect(q('compare-panel')).not.toBeInTheDocument();
    await userEvent.click(g('compare-btn-a1111111-1111-1111-1111-111111111111'));
    expect(g('compare-btn-a1111111-1111-1111-1111-111111111111')).toHaveAttribute('aria-pressed', 'true');
    expect(q('compare-panel')).not.toBeInTheDocument();
    await userEvent.click(g('compare-btn-a2222222-2222-2222-2222-222222222222'));
    expect(within(g('compare-panel')).getByText('AuditBot-7')).toBeInTheDocument();
    expect(within(g('compare-panel')).getByText('DevAgent-X')).toBeInTheDocument();
    await userEvent.click(g('compare-btn-a2222222-2222-2222-2222-222222222222'));
    expect(q('compare-panel')).not.toBeInTheDocument();
    await userEvent.click(g('compare-btn-a2222222-2222-2222-2222-222222222222'));
    await userEvent.click(g('compare-btn-a5555555-5555-5555-5555-555555555555'));
    await userEvent.click(g('compare-btn-a6666666-6666-6666-6666-666666666666'));
    expect(g('compare-btn-a6666666-6666-6666-6666-666666666666')).toHaveAttribute('aria-pressed', 'false');
  });
});
