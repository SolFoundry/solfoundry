import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BountyFlowDiagram } from '../components/how-it-works/BountyFlowDiagram';

describe('BountyFlowDiagram', () => {
  it('renders the full bounty lifecycle inside an interactive SVG diagram', () => {
    render(<BountyFlowDiagram />);

    expect(screen.getByRole('img', { name: /interactive bounty lifecycle flow diagram/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Post stage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Claim stage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Work stage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Submit stage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Review stage' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show Payment stage' })).toBeInTheDocument();
    expect(screen.getByTestId('flow-stage-payment')).toBeInTheDocument();
  });

  it('updates the explanatory tooltip when a stage is selected', async () => {
    render(<BountyFlowDiagram />);

    fireEvent.click(screen.getByRole('button', { name: 'Show Review stage' }));
    await waitFor(() => {
      expect(screen.getByText(/Automated checks, LLM review/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show Payment stage' }));
    await waitFor(() => {
      expect(screen.getByText(/Approved work releases the bounty reward/)).toBeInTheDocument();
    });
  });
});
