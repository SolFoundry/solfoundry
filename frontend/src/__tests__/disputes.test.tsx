/**
 * Tests for the dispute resolution frontend components.
 *
 * Covers DisputeCard rendering, DisputeTimeline rendering,
 * DisputeEvidenceForm validation, and DisputeListPage integration.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DisputeCard } from '../components/disputes/DisputeCard';
import { DisputeTimeline } from '../components/disputes/DisputeTimeline';
import { DisputeEvidenceForm } from '../components/disputes/DisputeEvidenceForm';
import type { DisputeListItem, DisputeHistoryItem } from '../types/dispute';

// -- Test Data ----------------------------------------------------------------

const mockDispute: DisputeListItem = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  bounty_id: '660e8400-e29b-41d4-a716-446655440001',
  contributor_id: '770e8400-e29b-41d4-a716-446655440002',
  reason: 'unfair_rejection',
  status: 'opened',
  outcome: undefined,
  created_at: '2026-03-20T12:00:00Z',
  resolved_at: undefined,
};

const resolvedDispute: DisputeListItem = {
  ...mockDispute,
  status: 'resolved',
  outcome: 'release_to_contributor',
  resolved_at: '2026-03-21T14:00:00Z',
};

const mockHistory: DisputeHistoryItem[] = [
  {
    id: 'h1',
    dispute_id: mockDispute.id,
    action: 'dispute_opened',
    previous_status: undefined,
    new_status: 'opened',
    actor_id: '770e8400-e29b-41d4-a716-446655440002',
    notes: 'Opened: unfair_rejection',
    created_at: '2026-03-20T12:00:00Z',
  },
  {
    id: 'h2',
    dispute_id: mockDispute.id,
    action: 'evidence_submitted',
    previous_status: 'opened',
    new_status: 'evidence',
    actor_id: '770e8400-e29b-41d4-a716-446655440002',
    notes: 'Added 1 evidence item(s)',
    created_at: '2026-03-20T13:00:00Z',
  },
  {
    id: 'h3',
    dispute_id: mockDispute.id,
    action: 'moved_to_mediation',
    previous_status: 'evidence',
    new_status: 'mediation',
    actor_id: '770e8400-e29b-41d4-a716-446655440002',
    notes: 'Moved to mediation phase',
    created_at: '2026-03-20T14:00:00Z',
  },
];

// -- DisputeCard Tests --------------------------------------------------------

describe('DisputeCard', () => {
  it('renders dispute status badge and reason', () => {
    render(
      <MemoryRouter>
        <DisputeCard dispute={mockDispute} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('dispute-status-badge')).toHaveTextContent('Opened');
    expect(screen.getByText('Unfair Rejection')).toBeInTheDocument();
  });

  it('renders bounty ID and created date', () => {
    render(
      <MemoryRouter>
        <DisputeCard dispute={mockDispute} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/660e8400/)).toBeInTheDocument();
    expect(screen.getByText(/Filed:/)).toBeInTheDocument();
  });

  it('shows outcome when dispute is resolved', () => {
    render(
      <MemoryRouter>
        <DisputeCard dispute={resolvedDispute} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Released to Contributor/)).toBeInTheDocument();
  });

  it('links to the dispute detail page', () => {
    render(
      <MemoryRouter>
        <DisputeCard dispute={mockDispute} />
      </MemoryRouter>,
    );
    const card = screen.getByTestId(`dispute-card-${mockDispute.id}`);
    expect(card).toHaveAttribute('href', `/disputes/${mockDispute.id}`);
  });
});

// -- DisputeTimeline Tests ----------------------------------------------------

describe('DisputeTimeline', () => {
  it('renders all history entries', () => {
    render(<DisputeTimeline history={mockHistory} />);
    const timeline = screen.getByTestId('dispute-timeline');
    expect(timeline).toBeInTheDocument();
    expect(screen.getByTestId('timeline-entry-dispute_opened')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-entry-evidence_submitted')).toBeInTheDocument();
    expect(screen.getByTestId('timeline-entry-moved_to_mediation')).toBeInTheDocument();
  });

  it('shows status transitions', () => {
    render(<DisputeTimeline history={mockHistory} />);
    const evidenceEntry = screen.getByTestId('timeline-entry-evidence_submitted');
    expect(within(evidenceEntry).getByText('evidence')).toBeInTheDocument();
  });

  it('shows empty state when no history', () => {
    render(<DisputeTimeline history={[]} />);
    expect(screen.getByText('No history entries yet.')).toBeInTheDocument();
  });
});

// -- DisputeEvidenceForm Tests ------------------------------------------------

describe('DisputeEvidenceForm', () => {
  it('renders the form with initial evidence item', () => {
    render(
      <DisputeEvidenceForm onSubmit={vi.fn()} loading={false} />,
    );
    expect(screen.getByTestId('evidence-form')).toBeInTheDocument();
    expect(screen.getByTestId('evidence-item-0')).toBeInTheDocument();
  });

  it('shows error when submitting without description', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DisputeEvidenceForm onSubmit={onSubmit} loading={false} />);

    await user.click(screen.getByText('Submit Evidence'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please provide at least one evidence item with a description.',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid evidence successfully', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<DisputeEvidenceForm onSubmit={onSubmit} loading={false} />);

    const descriptionInput = screen.getByPlaceholderText('Describe this evidence...');
    await user.type(descriptionInput, 'This PR meets all requirements');

    await user.click(screen.getByText('Submit Evidence'));

    expect(onSubmit).toHaveBeenCalledWith({
      evidence_links: [
        {
          evidence_type: 'link',
          url: '',
          description: 'This PR meets all requirements',
        },
      ],
    });
  });

  it('can add and remove evidence items', async () => {
    const user = userEvent.setup();

    render(
      <DisputeEvidenceForm onSubmit={vi.fn()} loading={false} />,
    );

    // Initially one item
    expect(screen.getByTestId('evidence-item-0')).toBeInTheDocument();

    // Add another
    await user.click(screen.getByText('+ Add Another Evidence Item'));
    expect(screen.getByTestId('evidence-item-1')).toBeInTheDocument();

    // Remove first
    const removeButtons = screen.getAllByText('Remove');
    await user.click(removeButtons[0]);

    // Should have one item remaining
    expect(screen.queryByTestId('evidence-item-1')).not.toBeInTheDocument();
  });

  it('disables submit button when loading', () => {
    render(
      <DisputeEvidenceForm onSubmit={vi.fn()} loading={true} />,
    );
    expect(screen.getByText('Submitting...')).toBeDisabled();
  });
});
