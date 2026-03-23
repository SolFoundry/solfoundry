/**
 * Tests for the admin dashboard frontend components.
 * Uses msw-style mocking via vi.fn() to isolate from the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Module mocks — hoisted above imports so vi.mock factories run before modules
// ---------------------------------------------------------------------------

vi.mock('../hooks/useAdminData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useAdminData')>();
  return {
    ...actual,
    getAdminToken: vi.fn(() => 'test-admin-key'),
    setAdminToken: vi.fn(),
    clearAdminToken: vi.fn(),
    useAdminOverview: vi.fn(),
    useAdminBounties: vi.fn(),
    useUpdateBounty: vi.fn(),
    useCloseBounty: vi.fn(),
    useAdminContributors: vi.fn(),
    useBanContributor: vi.fn(),
    useUnbanContributor: vi.fn(),
    useReviewPipeline: vi.fn(),
    useFinancialOverview: vi.fn(),
    usePayoutHistory: vi.fn(),
    useSystemHealth: vi.fn(),
    useAuditLog: vi.fn(),
    useTreasuryDashboard: vi.fn(),
  };
});

vi.mock('../hooks/useAdminWebSocket', () => ({
  useAdminWebSocket: vi.fn(() => ({ status: 'connected', lastEvent: null, disconnect: vi.fn() })),
}));

import * as adminData from '../hooks/useAdminData';
import { OverviewPanel } from '../components/admin/OverviewPanel';
import { BountyManagement } from '../components/admin/BountyManagement';
import { ContributorManagement } from '../components/admin/ContributorManagement';
import { ReviewPipeline } from '../components/admin/ReviewPipeline';
import { SystemHealth } from '../components/admin/SystemHealth';
import { AuditLogPanel } from '../components/admin/AuditLogPanel';
import { AdminLayout } from '../components/admin/AdminLayout';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children, qc }: { children: ReactNode; qc: QueryClient }) {
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function noopQuery() {
  return { data: undefined, isLoading: false, error: null, dataUpdatedAt: 0 };
}

function noopMutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false, error: null };
}

// ---------------------------------------------------------------------------
// AdminLayout — auth gate
// ---------------------------------------------------------------------------

describe('AdminLayout auth gate', () => {
  it('shows login form when no token is stored', () => {
    vi.mocked(adminData.getAdminToken).mockReturnValue('');
    const qc = makeQC();
    render(
      <Wrapper qc={qc}>
        <AdminLayout active="overview" onNavigate={vi.fn()}>
          <div>content</div>
        </AdminLayout>
      </Wrapper>,
    );
    expect(screen.getByTestId('admin-login-form')).toBeDefined();
    expect(screen.queryByTestId('admin-layout')).toBeNull();
  });

  it('renders layout when token is present', () => {
    vi.mocked(adminData.getAdminToken).mockReturnValue('secret-key');
    const qc = makeQC();
    render(
      <Wrapper qc={qc}>
        <AdminLayout active="overview" onNavigate={vi.fn()}>
          <div data-testid="child">content</div>
        </AdminLayout>
      </Wrapper>,
    );
    expect(screen.getByTestId('admin-layout')).toBeDefined();
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('shows login form after sign out', async () => {
    vi.mocked(adminData.getAdminToken).mockReturnValue('secret-key');
    const qc = makeQC();
    render(
      <Wrapper qc={qc}>
        <AdminLayout active="overview" onNavigate={vi.fn()}>
          <div>content</div>
        </AdminLayout>
      </Wrapper>,
    );
    fireEvent.click(screen.getByTestId('admin-signout'));
    await waitFor(() => expect(screen.getByTestId('admin-login-form')).toBeDefined());
  });

  it('saves token and shows layout on login', async () => {
    vi.mocked(adminData.getAdminToken).mockReturnValue('');
    const qc = makeQC();
    render(
      <Wrapper qc={qc}>
        <AdminLayout active="overview" onNavigate={vi.fn()}>
          <div>content</div>
        </AdminLayout>
      </Wrapper>,
    );
    fireEvent.change(screen.getByTestId('admin-key-input'), { target: { value: 'mykey' } });
    fireEvent.click(screen.getByTestId('admin-login-btn'));
    expect(adminData.setAdminToken).toHaveBeenCalledWith('mykey');
  });
});

// ---------------------------------------------------------------------------
// OverviewPanel
// ---------------------------------------------------------------------------

describe('OverviewPanel', () => {
  it('shows skeleton while loading', () => {
    vi.mocked(adminData.useAdminOverview).mockReturnValue({ ...noopQuery(), isLoading: true } as ReturnType<typeof adminData.useAdminOverview>);
    const qc = makeQC();
    const { container } = render(<Wrapper qc={qc}><OverviewPanel /></Wrapper>);
    const pulsingDivs = container.querySelectorAll('.animate-pulse');
    expect(pulsingDivs.length).toBeGreaterThan(0);
  });

  it('shows error message on failure', () => {
    vi.mocked(adminData.useAdminOverview).mockReturnValue({
      ...noopQuery(),
      error: new Error('Network error'),
    } as ReturnType<typeof adminData.useAdminOverview>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><OverviewPanel /></Wrapper>);
    expect(screen.getByRole('alert').textContent).toContain('Network error');
  });

  it('renders stat cards with data', () => {
    vi.mocked(adminData.useAdminOverview).mockReturnValue({
      ...noopQuery(),
      data: {
        total_bounties: 42,
        open_bounties: 10,
        completed_bounties: 30,
        cancelled_bounties: 2,
        total_contributors: 15,
        active_contributors: 14,
        banned_contributors: 1,
        total_fndry_paid: 50000,
        total_submissions: 100,
        pending_reviews: 3,
        uptime_seconds: 3600,
        timestamp: new Date().toISOString(),
      },
    } as ReturnType<typeof adminData.useAdminOverview>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><OverviewPanel /></Wrapper>);
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('15')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// BountyManagement
// ---------------------------------------------------------------------------

describe('BountyManagement', () => {
  beforeEach(() => {
    vi.mocked(adminData.useUpdateBounty).mockReturnValue(noopMutation() as ReturnType<typeof adminData.useUpdateBounty>);
    vi.mocked(adminData.useCloseBounty).mockReturnValue(noopMutation() as ReturnType<typeof adminData.useCloseBounty>);
  });

  it('shows empty state when no bounties', () => {
    vi.mocked(adminData.useAdminBounties).mockReturnValue({
      ...noopQuery(),
      data: { items: [], total: 0, page: 1, per_page: 20 },
    } as ReturnType<typeof adminData.useAdminBounties>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><BountyManagement /></Wrapper>);
    expect(screen.getByText('No bounties found')).toBeDefined();
  });

  it('renders bounty rows', () => {
    vi.mocked(adminData.useAdminBounties).mockReturnValue({
      ...noopQuery(),
      data: {
        items: [
          { id: 'b1', title: 'Fix the auth bug', status: 'open', tier: 1, reward_amount: 500, created_by: 'alice', deadline: '2026-04-01T00:00:00Z', submission_count: 3, created_at: '2026-03-01T00:00:00Z' },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      },
    } as ReturnType<typeof adminData.useAdminBounties>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><BountyManagement /></Wrapper>);
    expect(screen.getByText('Fix the auth bug')).toBeDefined();
    expect(screen.getByTestId('bounty-row-b1')).toBeDefined();
  });

  it('opens edit modal on Edit click', () => {
    vi.mocked(adminData.useAdminBounties).mockReturnValue({
      ...noopQuery(),
      data: {
        items: [
          { id: 'b1', title: 'Fix bug', status: 'open', tier: 1, reward_amount: 500, created_by: 'alice', deadline: '2026-04-01T00:00:00Z', submission_count: 0, created_at: '2026-03-01T00:00:00Z' },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      },
    } as ReturnType<typeof adminData.useAdminBounties>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><BountyManagement /></Wrapper>);
    fireEvent.click(screen.getByTestId('edit-bounty-b1'));
    expect(screen.getByTestId('bounty-edit-modal')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ContributorManagement
// ---------------------------------------------------------------------------

describe('ContributorManagement', () => {
  beforeEach(() => {
    vi.mocked(adminData.useBanContributor).mockReturnValue(noopMutation() as ReturnType<typeof adminData.useBanContributor>);
    vi.mocked(adminData.useUnbanContributor).mockReturnValue(noopMutation() as ReturnType<typeof adminData.useUnbanContributor>);
  });

  it('renders contributor rows', () => {
    vi.mocked(adminData.useAdminContributors).mockReturnValue({
      ...noopQuery(),
      data: {
        items: [
          { id: 'c1', username: 'alice', display_name: 'Alice', tier: 'T2', reputation_score: 85.5, total_bounties_completed: 5, total_earnings: 2500, is_banned: false, skills: ['React'], created_at: '2026-01-01T00:00:00Z' },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      },
    } as ReturnType<typeof adminData.useAdminContributors>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><ContributorManagement /></Wrapper>);
    expect(screen.getByText('@alice')).toBeDefined();
    expect(screen.getByTestId('ban-c1')).toBeDefined();
  });

  it('shows unban button for banned contributors', () => {
    vi.mocked(adminData.useAdminContributors).mockReturnValue({
      ...noopQuery(),
      data: {
        items: [
          { id: 'c2', username: 'bob', display_name: 'Bob', tier: 'T1', reputation_score: 20.0, total_bounties_completed: 1, total_earnings: 100, is_banned: true, skills: [], created_at: '2026-01-01T00:00:00Z' },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      },
    } as ReturnType<typeof adminData.useAdminContributors>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><ContributorManagement /></Wrapper>);
    expect(screen.getByTestId('unban-c2')).toBeDefined();
  });

  it('opens ban modal when ban button clicked', () => {
    vi.mocked(adminData.useAdminContributors).mockReturnValue({
      ...noopQuery(),
      data: {
        items: [
          { id: 'c1', username: 'alice', display_name: 'Alice', tier: 'T1', reputation_score: 10, total_bounties_completed: 0, total_earnings: 0, is_banned: false, skills: [], created_at: '2026-01-01T00:00:00Z' },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      },
    } as ReturnType<typeof adminData.useAdminContributors>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><ContributorManagement /></Wrapper>);
    fireEvent.click(screen.getByTestId('ban-c1'));
    expect(screen.getByTestId('ban-modal')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ReviewPipeline
// ---------------------------------------------------------------------------

describe('ReviewPipeline', () => {
  it('shows zero-state metrics when pipeline is empty', () => {
    vi.mocked(adminData.useReviewPipeline).mockReturnValue({
      ...noopQuery(),
      data: { active: [], total_active: 0, pass_rate: 0.0, avg_score: 0.0 },
    } as ReturnType<typeof adminData.useReviewPipeline>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><ReviewPipeline /></Wrapper>);
    expect(screen.getByText('0')).toBeDefined();
    expect(screen.getByText('No pending reviews')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SystemHealth
// ---------------------------------------------------------------------------

describe('SystemHealth', () => {
  it('renders healthy status', () => {
    vi.mocked(adminData.useSystemHealth).mockReturnValue({
      ...noopQuery(),
      data: {
        status: 'healthy',
        uptime_seconds: 7200,
        timestamp: new Date().toISOString(),
        services: { database: 'connected', redis: 'connected' },
        queue_depth: 0,
        webhook_events_processed: 12,
        active_websocket_connections: 3,
      },
    } as ReturnType<typeof adminData.useSystemHealth>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><SystemHealth /></Wrapper>);
    expect(screen.getByText('healthy')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AuditLogPanel
// ---------------------------------------------------------------------------

describe('AuditLogPanel', () => {
  it('shows empty state when no entries', () => {
    vi.mocked(adminData.useAuditLog).mockReturnValue({
      ...noopQuery(),
      data: { entries: [], total: 0 },
    } as ReturnType<typeof adminData.useAuditLog>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><AuditLogPanel /></Wrapper>);
    expect(screen.getByText('No audit events recorded yet')).toBeDefined();
  });

  it('renders audit entries', () => {
    vi.mocked(adminData.useAuditLog).mockReturnValue({
      ...noopQuery(),
      data: {
        entries: [
          { event: 'admin_bounty_closed', actor: 'admin', timestamp: new Date().toISOString(), details: { bounty_id: 'b1' } },
        ],
        total: 1,
      },
    } as ReturnType<typeof adminData.useAuditLog>);
    const qc = makeQC();
    render(<Wrapper qc={qc}><AuditLogPanel /></Wrapper>);
    expect(screen.getByText('admin_bounty_closed')).toBeDefined();
    expect(screen.getByTestId('audit-entry-0')).toBeDefined();
  });
});
