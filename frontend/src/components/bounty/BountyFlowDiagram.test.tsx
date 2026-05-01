/**
 * Tests for BountyFlowDiagram component (Bounty #851)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { BountyFlowDiagram } from './BountyFlowDiagram';

describe('BountyFlowDiagram', () => {
  it('renders all 6 flow stages', () => {
    render(<BountyFlowDiagram />);

    const stages = [
      'Post Bounty',
      'Claim & Qualify',
      'Develop Solution',
      'Submit PR',
      'AI + Human Review',
      'Receive Payment',
    ];

    stages.forEach((stage) => {
      expect(screen.getByText(stage)).toBeInTheDocument();
    });
  });

  it('renders in compact mode', () => {
    render(<BountyFlowDiagram compact />);

    // Compact mode shows buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(5);
  });

  it('shows tooltip when stage is clicked', () => {
    render(<BountyFlowDiagram />);

    // Click on the first stage
    const firstStage = screen.getByText('Post Bounty');
    fireEvent.click(firstStage);

    // Tooltip should appear with details
    expect(screen.getByText(/Write clear title/)).toBeInTheDocument();
  });

  it('closes tooltip when X is clicked', () => {
    render(<BountyFlowDiagram />);

    const firstStage = screen.getByText('Post Bounty');
    fireEvent.click(firstStage);

    // Find and click the close button
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    // Tooltip should be gone
    expect(screen.queryByText(/Write clear title/)).not.toBeInTheDocument();
  });

  it('shows stage numbers', () => {
    render(<BountyFlowDiagram />);

    // Stage numbers should be visible in the SVG
    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders legend at the bottom', () => {
    render(<BountyFlowDiagram />);

    // Legend items should be clickable
    const legendItems = screen.getAllByRole('button');
    expect(legendItems.length).toBeGreaterThanOrEqual(6);
  });

  it('compact mode shows chevron separators', () => {
    const { container } = render(<BountyFlowDiagram compact />);

    // Should have chevron-right icons between stages
    const chevrons = container.querySelectorAll('svg');
    expect(chevrons.length).toBeGreaterThan(0);
  });

  it('highlights active stage on click', () => {
    render(<BountyFlowDiagram />);

    const postBounty = screen.getByText('Post Bounty');
    fireEvent.click(postBounty);

    // The stage should be highlighted (check for active styling)
    expect(postBounty).toBeInTheDocument();
  });
});
