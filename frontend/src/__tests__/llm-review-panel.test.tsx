import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LLMReviewPanel } from '../components/bounty/LLMReviewPanel';
import type { Bounty } from '../types/bounty';

const bounty: Bounty = {
  id: 'bounty-1',
  title: 'Build review dashboard',
  description: 'Show LLM review scores',
  status: 'open',
  tier: 'T2',
  reward_amount: 450_000,
  reward_token: 'FNDRY',
  github_issue_url: 'https://github.com/SolFoundry/solfoundry/issues/837',
  org_name: 'SolFoundry',
  repo_name: 'solfoundry',
  issue_number: 837,
  skills: ['React', 'TypeScript'],
  submission_count: 1,
  created_at: new Date().toISOString(),
};

describe('LLMReviewPanel', () => {
  it('renders review scores and confidence for all three LLMs', () => {
    render(<LLMReviewPanel bounty={bounty} />);

    expect(screen.getByTestId('llm-review-panel')).toBeInTheDocument();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Gemini')).toBeInTheDocument();
    expect(screen.getAllByText('Score')).toHaveLength(3);
    expect(screen.getAllByText('Confidence')).toHaveLength(3);
    expect(screen.getAllByText('Full reasoning')).toHaveLength(3);
  });

  it('uses API-provided review details when available', () => {
    render(
      <LLMReviewPanel
        bounty={{
          ...bounty,
          llm_reviews: [
            {
              provider: 'Claude',
              score: 9.2,
              confidence: 94,
              quality: 'excellent',
              summary: 'Strong implementation with clear reasoning.',
              suggested_improvements: ['Add one more regression test.'],
              reasoning_url: 'https://example.com/review/claude',
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('9.2/10').length).toBeGreaterThan(0);
    expect(screen.getByText('94%')).toBeInTheDocument();
    expect(screen.getByText('Strong implementation with clear reasoning.')).toBeInTheDocument();
  });
});
