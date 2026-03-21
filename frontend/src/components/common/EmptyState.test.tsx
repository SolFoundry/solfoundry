/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  EmptyState,
  NoBountiesFound,
  NoContributionsYet,
  NoActivityYet,
  NoSearchResults,
  NoDataAvailable,
} from './EmptyState';

describe('EmptyState Components', () => {
  describe('EmptyState', () => {
    it('renders with required props', () => {
      render(<EmptyState title="No data" />);
      expect(screen.getByText('No data')).toBeTruthy();
    });

    it('renders with description', () => {
      render(<EmptyState title="No data" description="Try again later" />);
      expect(screen.getByText('No data')).toBeTruthy();
      expect(screen.getByText('Try again later')).toBeTruthy();
    });

    it('renders with action button', () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          title="No data"
          actionLabel="Reset"
          onAction={onAction}
        />
      );
      
      const button = screen.getByTestId('empty-state-action');
      fireEvent.click(button);
      expect(onAction).toHaveBeenCalled();
    });

    it('renders with emoji icon', () => {
      render(<EmptyState title="No data" icon="📭" />);
      expect(screen.getByText('📭')).toBeTruthy();
    });

    it('applies size variants', () => {
      const { container: sm } = render(<EmptyState title="Test" size="sm" />);
      const { container: md } = render(<EmptyState title="Test" size="md" />);
      const { container: lg } = render(<EmptyState title="Test" size="lg" />);
      
      expect(sm.firstChild).toBeTruthy();
      expect(md.firstChild).toBeTruthy();
      expect(lg.firstChild).toBeTruthy();
    });

    it('renders card variant', () => {
      const { container } = render(<EmptyState title="Test" variant="card" />);
      expect(container.firstChild).toHaveClass('rounded-xl');
    });

    it('renders compact variant', () => {
      const { container } = render(<EmptyState title="Test" variant="compact" />);
      expect(container.firstChild).toHaveClass('flex');
    });
  });

  describe('NoBountiesFound', () => {
    it('renders without filters', () => {
      render(<NoBountiesFound />);
      expect(screen.getByText('No bounties found')).toBeTruthy();
    });

    it('renders with reset button when hasFilters is true', () => {
      const onReset = vi.fn();
      render(<NoBountiesFound hasFilters onReset={onReset} />);
      
      const button = screen.getByTestId('empty-bounties-action');
      expect(button).toBeTruthy();
      fireEvent.click(button);
      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('NoContributionsYet', () => {
    it('renders correctly', () => {
      render(<NoContributionsYet />);
      expect(screen.getByText('No contributions yet')).toBeTruthy();
    });
  });

  describe('NoActivityYet', () => {
    it('renders correctly', () => {
      render(<NoActivityYet />);
      expect(screen.getByText('No activity yet')).toBeTruthy();
    });
  });

  describe('NoSearchResults', () => {
    it('renders without query', () => {
      render(<NoSearchResults />);
      expect(screen.getByText('No results found')).toBeTruthy();
    });

    it('renders with query', () => {
      render(<NoSearchResults query="test query" />);
      expect(screen.getByText(/test query/)).toBeTruthy();
    });
  });

  describe('NoDataAvailable', () => {
    it('renders with default dataType', () => {
      render(<NoDataAvailable />);
      expect(screen.getByText('No data available')).toBeTruthy();
    });

    it('renders with custom dataType', () => {
      render(<NoDataAvailable dataType="bounties" />);
      expect(screen.getByText('No bounties available')).toBeTruthy();
    });
  });
});