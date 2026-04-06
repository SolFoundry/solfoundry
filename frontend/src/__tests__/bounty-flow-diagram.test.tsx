import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BountyFlowDiagram } from '../components/how-it-works/BountyFlowDiagram';

describe('BountyFlowDiagram', () => {
  it('renders all lifecycle stages', () => {
    render(<BountyFlowDiagram />);

    ['Post', 'Claim', 'Work', 'Submit', 'Review', 'Payment'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  it('shows review content by default and updates when another stage is selected', async () => {
    render(<BountyFlowDiagram />);

    const panel = screen.getByTestId('active-stage-panel');
    expect(within(panel).getByText('Review')).toBeInTheDocument();
    expect(within(panel).getByText(/Review can include code quality, test pass status, UX validation/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('stage-button-payment'));

    await waitFor(() => {
      expect(within(panel).getByText('Payment')).toBeInTheDocument();
    });
    expect(within(panel).getByText(/Approved work triggers token or stablecoin payout/i)).toBeInTheDocument();
  });
});
