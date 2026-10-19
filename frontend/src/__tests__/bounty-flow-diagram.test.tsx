import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BountyFlowDiagram } from '../components/how-it-works/BountyFlowDiagram';

describe('BountyFlowDiagram', () => {
  it('renders the interactive lifecycle SVG and default stage copy', () => {
    render(<BountyFlowDiagram />);

    expect(screen.getByTestId('bounty-flow-svg')).toBeInTheDocument();
    expect(screen.getByText('Bounty flow from post to payout')).toBeInTheDocument();
    expect(screen.getByText('Post bounty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Payment stage' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('updates the tooltip when a stage is clicked', async () => {
    const user = userEvent.setup();
    render(<BountyFlowDiagram />);

    await user.click(screen.getByRole('button', { name: 'Show Review stage' }));

    expect(screen.getByRole('button', { name: 'Show Review stage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('stage-tooltip')).toHaveTextContent(
      'Automated and maintainer review checks quality, scope, and eligibility.',
    );
  });

  it('supports keyboard activation for SVG stages', async () => {
    const user = userEvent.setup();
    render(<BountyFlowDiagram />);

    const paymentStage = screen.getByRole('button', { name: 'Show Payment stage' });
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
    }
    expect(paymentStage).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(paymentStage).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('stage-tooltip')).toHaveTextContent(
      'Approved work is merged and paid from the bounty mechanism.',
    );
  });
});
