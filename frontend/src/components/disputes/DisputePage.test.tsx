import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { DisputePage } from './DisputePage';

const mockDispute = {
  id: 'dispute-001',
  bounty_id: 'bounty-001',
  submission_id: 'sub-001',
  contributor_id: 'user-contributor',
  creator_id: 'user-creator',
  reason: 'valid_submission_rejected',
  description: 'My submission meets all requirements but was unfairly rejected.',
  state: 'evidence' as const,
  outcome: undefined,
  ai_review_score: undefined,
  ai_review_summary: undefined,
  mediation_type: undefined,
  resolver_id: undefined,
  resolution_notes: undefined,
  split_contributor_pct: undefined,
  split_creator_pct: undefined,
  reputation_impact_applied: false,
  contributor_reputation_delta: 0,
  creator_reputation_delta: 0,
  evidence_deadline: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  resolved_at: undefined,
  evidence: [
    {
      id: 'ev-001',
      dispute_id: 'dispute-001',
      submitted_by: 'user-contributor',
      party: 'contributor' as const,
      evidence_type: 'explanation',
      url: undefined,
      description: 'The submission passes all test cases.',
      extra_data: {},
      created_at: new Date().toISOString(),
    },
  ],
  audit_trail: [
    {
      id: 'audit-001',
      dispute_id: 'dispute-001',
      action: 'dispute_opened',
      previous_state: undefined,
      new_state: 'opened',
      actor_id: 'user-contributor',
      details: {},
      notes: undefined,
      created_at: new Date().toISOString(),
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('DisputePage', () => {
  it('renders dispute header with state badge', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Dispute')).toBeInTheDocument();
    });

    expect(screen.getByText('Evidence Collection')).toBeInTheDocument();
  });

  it('renders evidence items', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('The submission passes all test cases.')).toBeInTheDocument();
    });
  });

  it('shows evidence form for contributor during evidence phase', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Submit Evidence')).toBeInTheDocument();
    });
  });

  it('shows Submit for Mediation button for parties', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Submit for Mediation')).toBeInTheDocument();
    });
  });

  it('hides evidence form for non-parties', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-random"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Dispute')).toBeInTheDocument();
    });

    expect(screen.queryByText('Submit Evidence')).not.toBeInTheDocument();
  });

  it('shows admin resolve panel when admin and mediation state', async () => {
    const mediationDispute = {
      ...mockDispute,
      state: 'mediation' as const,
      ai_review_score: 5.3,
      ai_review_summary: 'AI analysis indicates below threshold.',
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mediationDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="admin-user"
        isAdmin
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Resolution')).toBeInTheDocument();
    });

    expect(screen.getByText('Resolve Dispute')).toBeInTheDocument();
  });

  it('renders resolved state with outcome banner', async () => {
    const resolved = {
      ...mockDispute,
      state: 'resolved' as const,
      outcome: 'release_to_contributor' as const,
      resolution_notes: 'The submission clearly met all criteria.',
      mediation_type: 'admin_manual',
      reputation_impact_applied: true,
      contributor_reputation_delta: 10,
      creator_reputation_delta: -25,
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(resolved),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Released to Contributor')).toBeInTheDocument();
    });

    expect(screen.getByText('The submission clearly met all criteria.')).toBeInTheDocument();
  });

  it('shows audit trail entries', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('dispute opened')).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ detail: 'Not found' }),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Failed to load dispute')).toBeInTheDocument();
    });
  });

  it('renders the state progress bar', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDispute),
    } as any);

    render(
      <DisputePage
        disputeId="dispute-001"
        currentUserId="user-contributor"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });

    expect(screen.getByText('Opened')).toBeInTheDocument();
    expect(screen.getByText('Under Mediation')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });
});
