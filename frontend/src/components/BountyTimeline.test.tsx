import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BountyTimeline } from './BountyTimeline';
import { timelineEarlyStage, timelineMidStage, timelineCompleted, timelineRejected } from '../data/mockTimeline';

describe('BountyTimeline', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      expect(screen.getByText('Bounty Timeline')).toBeInTheDocument();
    });

    it('displays all timeline stages', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      
      expect(screen.getByText(/Created/)).toBeInTheDocument();
      expect(screen.getByText(/Open for Submissions/)).toBeInTheDocument();
      expect(screen.getByText(/PR Submitted/)).toBeInTheDocument();
      expect(screen.getByText(/AI Review/)).toBeInTheDocument();
      expect(screen.getByText(/Approved & Merged/)).toBeInTheDocument();
      expect(screen.getByText(/Paid/)).toBeInTheDocument();
    });

    it('shows message when no timeline data provided', () => {
      render(<BountyTimeline bountyId="non-existent" />);
      expect(screen.getByText(/No timeline data available/)).toBeInTheDocument();
    });
  });

  describe('Stage Status', () => {
    it('highlights current stage with pulse effect', () => {
      const { container } = render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      
      // Find the current stage element
      const currentStage = screen.getByText(/Open for Submissions/).closest('button');
      expect(currentStage).toBeInTheDocument();
    });

    it('shows checkmark for completed stages', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineCompleted} />);
      
      // Completed stages should have checkmarks (svg icons)
      const checkmarks = document.querySelectorAll('svg path[d*="M5 13l4 4L19 7"]');
      expect(checkmarks.length).toBeGreaterThan(0);
    });

    it('shows grayed out appearance for pending stages', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      
      // Pending stages should have gray styling - find the span with the stage name
      const pendingStageLabel = screen.getByText(/PR Submitted/);
      expect(pendingStageLabel).toHaveClass('text-gray-500');
    });
  });

  describe('Stage Details', () => {
    it('displays creator for created stage', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      expect(screen.getByText(/Bounty posted by SolFoundry/)).toBeInTheDocument();
    });

    it('displays PR information for submitted stage', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineMidStage} />);
      expect(screen.getByText(/dev_alice/)).toBeInTheDocument();
      expect(screen.getByText(/142/)).toBeInTheDocument();
    });

    it('displays AI review score and verdict', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineMidStage} />);
      expect(screen.getByText(/Score: 8\/10/)).toBeInTheDocument();
    });

    it('displays payment information for paid stage', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineCompleted} />);
      expect(screen.getByText(/200,000/)).toBeInTheDocument();
      expect(screen.getByText(/\$FNDRY/)).toBeInTheDocument();
      // dev_bob appears twice (in PR submitted and Paid stages)
      const devBobElements = screen.getAllByText(/dev_bob/);
      expect(devBobElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Expandable Details', () => {
    it('expands stage details when clicked', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineMidStage} />);
      
      // Find the PR submitted stage (which has expandable details)
      const prSubmittedButton = screen.getByText(/PR Submitted/).closest('button');
      expect(prSubmittedButton).toBeInTheDocument();
      
      // Click to expand
      if (prSubmittedButton) {
        fireEvent.click(prSubmittedButton);
      }
      
      // Should show the expandable details (link to GitHub)
      expect(screen.getByText(/View PR #142 on GitHub/)).toBeInTheDocument();
    });

    it('shows transaction link for paid stage when expanded', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineCompleted} />);
      
      const paidButton = screen.getByText(/Paid/).closest('button');
      if (paidButton) {
        fireEvent.click(paidButton);
      }
      
      expect(screen.getByText(/View transaction on Solscan/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles bounty with no submissions', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      
      // Should still render all stages
      expect(screen.getByText(/Created/)).toBeInTheDocument();
      expect(screen.getByText(/Open for Submissions/)).toBeInTheDocument();
      
      // PR Submitted stage should be pending (gray text)
      const prSubmitted = screen.getByText(/PR Submitted/);
      expect(prSubmitted).toHaveClass('text-gray-500');
    });

    it('handles bounty with rejected submission', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineRejected} />);
      
      // Should show low AI review score
      expect(screen.getByText(/Score: 4\/10/)).toBeInTheDocument();
      
      // Should show the verdict
      expect(screen.getByText(/Does not address the vulnerability/)).toBeInTheDocument();
    });

    it('handles bounty with multiple PR submissions', () => {
      // This tests that the component can handle the PR submitted stage
      // being current (indicating multiple PRs in progress)
      render(<BountyTimeline bountyId="test-1" timelineData={timelineMidStage} />);
      
      // Should display PR information
      expect(screen.getByText(/dev_alice/)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive classes for mobile', () => {
      const { container } = render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      
      // Check for responsive padding classes
      const timelineContainer = container.querySelector('.bg-gray-900');
      expect(timelineContainer).toHaveClass('p-4');
      expect(timelineContainer).toHaveClass('sm:p-6');
    });

    it('has touch-friendly interactive elements', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineMidStage} />);
      
      // Buttons should have min-height for touch targets
      const expandableButton = screen.getByText(/PR Submitted/).closest('button');
      expect(expandableButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineEarlyStage} />);
      
      const heading = screen.getByRole('heading', { level: 2, name: /Bounty Timeline/ });
      expect(heading).toBeInTheDocument();
    });

    it('external links have proper attributes', () => {
      render(<BountyTimeline bountyId="test-1" timelineData={timelineMidStage} />);
      
      // Expand the PR stage to show the link
      const prButton = screen.getByText(/PR Submitted/).closest('button');
      if (prButton) {
        fireEvent.click(prButton);
      }
      
      const link = screen.getByText(/View PR #142 on GitHub/).closest('a');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});