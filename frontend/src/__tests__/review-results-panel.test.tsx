import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReviewResultsPanel } from '../components/bounty/ReviewResultsPanel';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function okJson(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: function () { return this; },
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => mockFetch.mockReset());

describe('ReviewResultsPanel', () => {
  it('renders model scores, confidence and full review link', async () => {
    mockFetch.mockImplementation((url: unknown) => {
      const s = String(url ?? '');
      if (s.includes('/submissions')) {
        return Promise.resolve(okJson([
          {
            id: 'sub-1',
            bounty_id: 'b-1',
            contributor_id: 'u-1',
            contributor_username: 'alice',
            status: 'approved',
            ai_score: 8.2,
            ai_scores_by_model: { claude: 8.4, codex: 7.9, gemini: 8.3 },
            review_complete: true,
            meets_threshold: true,
            confidence_percentage: 92,
            review_reasoning: 'Good structure and strong implementation. Consider polishing edge cases.',
            review_details_url: 'https://example.com/review/sub-1',
            created_at: new Date().toISOString(),
          },
        ]));
      }
      return Promise.resolve(okJson([]));
    });

    renderWithQuery(<ReviewResultsPanel bountyId="b-1" />);

    await screen.findByTestId('model-score-claude');

    expect(screen.getByTestId('model-score-claude')).toBeInTheDocument();
    expect(screen.getByTestId('model-score-codex')).toBeInTheDocument();
    expect(screen.getByTestId('model-score-gemini')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Pass threshold')).toBeInTheDocument();
    expect(screen.getByText(/Good structure and strong implementation/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Full review details/i })).toHaveAttribute('href', 'https://example.com/review/sub-1');
  });

  it('renders empty state when no completed review exists', async () => {
    mockFetch.mockResolvedValue(okJson([]));
    renderWithQuery(<ReviewResultsPanel bountyId="b-2" />);

    await waitFor(() => {
      expect(screen.getByText(/No completed LLM review results yet/i)).toBeInTheDocument();
    });
  });
});
