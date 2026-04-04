/**
 * Tests for the multi-LLM review score dashboard.
 *
 * Covers ReviewScorePanel (score visualization, consensus, disagreement),
 * AppealWorkflow (file + assign), and AppealHistory (resolution tracking).
 *
 * @module __tests__/review-scores.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

vi.mock('../hooks/useReviewScores', () => ({
  useReviewScores: vi.fn(),
  useAppeal: vi.fn(),
}));

import { ReviewScorePanel } from '../components/reviews/ReviewScorePanel';
import { AppealWorkflow } from '../components/reviews/AppealWorkflow';
import { AppealHistory } from '../components/reviews/AppealHistory';
import { useReviewScores, useAppeal } from '../hooks/useReviewScores';
import type { ReviewScore, Appeal } from '../hooks/useReviewScores';

const mockUseReviewScores = useReviewScores as ReturnType<typeof vi.fn>;
const mockUseAppeal = useAppeal as ReturnType<typeof vi.fn>;

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCORES_CONSENSUS: ReviewScore[] = [
  { reviewer: 'claude',  score: 8.5, reasoning: 'Well-structured solution with good test coverage.', model_id: 'claude-sonnet-4-6',   reviewed_at: '2026-04-04T10:00:00Z' },
  { reviewer: 'codex',   score: 8.2, reasoning: 'Clean implementation, minor style issues.',         model_id: 'gpt-4o',              reviewed_at: '2026-04-04T10:01:00Z' },
  { reviewer: 'gemini',  score: 8.7, reasoning: 'Meets all acceptance criteria.',                    model_id: 'gemini-1.5-pro',      reviewed_at: '2026-04-04T10:02:00Z' },
];

const SCORES_DISAGREEMENT: ReviewScore[] = [
  { reviewer: 'claude',  score: 9.0, reasoning: 'Excellent solution, exceeds requirements.', model_id: 'claude-sonnet-4-6', reviewed_at: '2026-04-04T10:00:00Z' },
  { reviewer: 'codex',   score: 4.5, reasoning: 'Missing key functionality.',                model_id: 'gpt-4o',            reviewed_at: '2026-04-04T10:01:00Z' },
  { reviewer: 'gemini',  score: 8.0, reasoning: 'Mostly complete.',                          model_id: 'gemini-1.5-pro',    reviewed_at: '2026-04-04T10:02:00Z' },
];

const OPEN_APPEAL: Appeal = {
  id: 'appeal-001',
  submission_id: 'sub-001',
  status: 'pending',
  reason: 'Scores do not reflect the full solution.',
  filed_at: '2026-04-04T11:00:00Z',
  reviewer_id: null,
  reviewer_name: null,
  resolution: null,
  resolved_at: null,
  history: [],
};

const ASSIGNED_APPEAL: Appeal = {
  ...OPEN_APPEAL,
  id: 'appeal-002',
  status: 'assigned',
  reviewer_id: 'reviewer-001',
  reviewer_name: 'Jane Doe',
  history: [
    { id: 'ah1', action: 'filed',    actor: 'Contributor', note: 'Appeal filed',         created_at: '2026-04-04T11:00:00Z' },
    { id: 'ah2', action: 'assigned', actor: 'Admin',       note: 'Assigned to Jane Doe', created_at: '2026-04-04T11:30:00Z' },
  ],
};

const RESOLVED_APPEAL: Appeal = {
  ...ASSIGNED_APPEAL,
  id: 'appeal-003',
  status: 'resolved',
  resolution: 'Score revised upward to 8.5 after human review.',
  resolved_at: '2026-04-04T14:00:00Z',
  history: [
    ...ASSIGNED_APPEAL.history,
    { id: 'ah3', action: 'resolved', actor: 'Jane Doe', note: 'Revised score accepted', created_at: '2026-04-04T14:00:00Z' },
  ],
};

// ---------------------------------------------------------------------------
// ReviewScorePanel
// ---------------------------------------------------------------------------

describe('ReviewScorePanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders heading and all three reviewers', () => {
    mockUseReviewScores.mockReturnValue({ scores: SCORES_CONSENSUS, isLoading: false, error: null });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByText('Review Scores')).toBeDefined();
    expect(screen.getByText('Claude')).toBeDefined();
    expect(screen.getByText('Codex')).toBeDefined();
    expect(screen.getByText('Gemini')).toBeDefined();
  });

  it('shows score for each reviewer', () => {
    mockUseReviewScores.mockReturnValue({ scores: SCORES_CONSENSUS, isLoading: false, error: null });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByTestId('score-claude')).toHaveTextContent('8.5');
    expect(screen.getByTestId('score-codex')).toHaveTextContent('8.2');
    expect(screen.getByTestId('score-gemini')).toHaveTextContent('8.7');
  });

  it('shows reasoning for each reviewer', () => {
    mockUseReviewScores.mockReturnValue({ scores: SCORES_CONSENSUS, isLoading: false, error: null });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByText('Well-structured solution with good test coverage.')).toBeDefined();
    expect(screen.getByText('Clean implementation, minor style issues.')).toBeDefined();
  });

  it('shows consensus indicator when scores agree (spread ≤ 1.5)', () => {
    mockUseReviewScores.mockReturnValue({ scores: SCORES_CONSENSUS, isLoading: false, error: null });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByTestId('consensus-indicator')).toHaveTextContent(/consensus/i);
  });

  it('shows disagreement indicator when scores diverge (spread > 1.5)', () => {
    mockUseReviewScores.mockReturnValue({ scores: SCORES_DISAGREEMENT, isLoading: false, error: null });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByTestId('consensus-indicator')).toHaveTextContent(/disagreement/i);
  });

  it('shows average score', () => {
    mockUseReviewScores.mockReturnValue({ scores: SCORES_CONSENSUS, isLoading: false, error: null });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    // avg of 8.5, 8.2, 8.7 = 8.47
    expect(screen.getByTestId('average-score')).toBeDefined();
  });

  it('shows model ID for each reviewer', () => {
    mockUseReviewScores.mockReturnValue({ scores: SCORES_CONSENSUS, isLoading: false, error: null });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByText('claude-sonnet-4-6')).toBeDefined();
    expect(screen.getByText('gpt-4o')).toBeDefined();
  });

  it('shows loading skeleton when loading', () => {
    mockUseReviewScores.mockReturnValue({ scores: [], isLoading: true, error: null });
    const { container } = render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows error state', () => {
    mockUseReviewScores.mockReturnValue({ scores: [], isLoading: false, error: new Error('Failed') });
    render(<ReviewScorePanel submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByRole('alert')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AppealWorkflow
// ---------------------------------------------------------------------------

describe('AppealWorkflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders File Appeal button when no appeal exists', () => {
    mockUseAppeal.mockReturnValue({ appeal: null, fileAppeal: vi.fn(), isLoading: false });
    render(<AppealWorkflow submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByRole('button', { name: /file appeal/i })).toBeDefined();
  });

  it('opens appeal form on File Appeal click', async () => {
    mockUseAppeal.mockReturnValue({ appeal: null, fileAppeal: vi.fn(), isLoading: false });
    const u = userEvent.setup();
    render(<AppealWorkflow submissionId="sub-001" />, { wrapper: wrap() });
    await u.click(screen.getByRole('button', { name: /file appeal/i }));
    expect(screen.getByTestId('appeal-form')).toBeDefined();
  });

  it('submit is disabled until reason is entered', async () => {
    mockUseAppeal.mockReturnValue({ appeal: null, fileAppeal: vi.fn(), isLoading: false });
    const u = userEvent.setup();
    render(<AppealWorkflow submissionId="sub-001" />, { wrapper: wrap() });
    await u.click(screen.getByRole('button', { name: /file appeal/i }));
    expect(screen.getByTestId('submit-appeal')).toBeDisabled();
  });

  it('calls fileAppeal with reason when submitted', async () => {
    const fileAppeal = vi.fn();
    mockUseAppeal.mockReturnValue({ appeal: null, fileAppeal, isLoading: false });
    const u = userEvent.setup();
    render(<AppealWorkflow submissionId="sub-001" />, { wrapper: wrap() });
    await u.click(screen.getByRole('button', { name: /file appeal/i }));
    await u.type(screen.getByTestId('appeal-reason-input'), 'Scores are incorrect');
    await u.click(screen.getByTestId('submit-appeal'));
    expect(fileAppeal).toHaveBeenCalledWith({ reason: 'Scores are incorrect' });
  });

  it('shows pending status badge when appeal is pending', () => {
    mockUseAppeal.mockReturnValue({ appeal: OPEN_APPEAL, fileAppeal: vi.fn(), isLoading: false });
    render(<AppealWorkflow submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByTestId('appeal-status')).toHaveTextContent(/pending/i);
  });

  it('shows assigned reviewer name when appeal is assigned', () => {
    mockUseAppeal.mockReturnValue({ appeal: ASSIGNED_APPEAL, fileAppeal: vi.fn(), isLoading: false });
    render(<AppealWorkflow submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByTestId('assigned-reviewer')).toHaveTextContent('Jane Doe');
  });

  it('shows resolution when appeal is resolved', () => {
    mockUseAppeal.mockReturnValue({ appeal: RESOLVED_APPEAL, fileAppeal: vi.fn(), isLoading: false });
    render(<AppealWorkflow submissionId="sub-001" />, { wrapper: wrap() });
    expect(screen.getByTestId('appeal-resolution')).toHaveTextContent('Score revised upward');
  });
});

// ---------------------------------------------------------------------------
// AppealHistory
// ---------------------------------------------------------------------------

describe('AppealHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows empty state when no history', () => {
    render(<AppealHistory history={[]} />, { wrapper: wrap() });
    expect(screen.getByText('No appeal history yet.')).toBeDefined();
  });

  it('renders all history entries', () => {
    render(<AppealHistory history={ASSIGNED_APPEAL.history} />, { wrapper: wrap() });
    expect(screen.getByTestId('appeal-history-entry-ah1')).toBeDefined();
    expect(screen.getByTestId('appeal-history-entry-ah2')).toBeDefined();
  });

  it('shows actor and note for each entry', () => {
    render(<AppealHistory history={ASSIGNED_APPEAL.history} />, { wrapper: wrap() });
    expect(screen.getByText('Appeal filed')).toBeDefined();
    expect(screen.getByText('Assigned to Jane Doe')).toBeDefined();
  });

  it('highlights resolved entry', () => {
    render(<AppealHistory history={RESOLVED_APPEAL.history} />, { wrapper: wrap() });
    expect(screen.getByTestId('appeal-history-entry-ah3')).toBeDefined();
    expect(screen.getByText('Revised score accepted')).toBeDefined();
  });
});
