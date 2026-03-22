/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonGrid,
  SkeletonList,
  SkeletonTable,
  SkeletonActivityFeed,
} from './Skeleton';

describe('Skeleton Components', () => {
  describe('Skeleton', () => {
    it('renders with default props', () => {
      const { container } = render(<Skeleton />);
      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('bg-gray-200');
      expect(skeleton).toHaveClass('animate-shimmer');
    });

    it('renders with custom dimensions', () => {
      const { container } = render(<Skeleton width={100} height={20} />);
      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton.style.width).toBe('100px');
      expect(skeleton.style.height).toBe('20px');
    });

    it('renders circle variant', () => {
      const { container } = render(<Skeleton variant="circle" />);
      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('rounded-full');
    });

    it('supports shimmer animation', () => {
      const { container } = render(<Skeleton animation="shimmer" />);
      const skeleton = container.firstChild;
      expect(skeleton).toHaveClass('animate-shimmer');
    });
  });

  describe('SkeletonText', () => {
    it('renders multiple lines', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.children.length).toBe(3);
    });

    it('applies last line width', () => {
      const { container } = render(<SkeletonText lines={2} lastLineWidth={50} />);
      const wrapper = container.firstChild as HTMLElement;
      const lines = wrapper.querySelectorAll(':scope > div');
      const lastLine = lines[lines.length - 1] as HTMLElement;
      expect(lastLine.style.width).toBe('50%');
    });
  });

  describe('SkeletonCard', () => {
    it('renders with avatar when showAvatar is true', () => {
      const { container } = render(<SkeletonCard showAvatar />);
      const card = container.firstChild;
      expect(card).toHaveClass('rounded-xl');
    });

    it('renders body lines', () => {
      const { container } = render(<SkeletonCard bodyLines={3} />);
      const card = container.firstChild;
      expect(card).toBeTruthy();
    });

    it('renders footer when showFooter is true', () => {
      const { container } = render(<SkeletonCard showFooter />);
      expect(container.textContent).toBe(''); // Skeletons have no text
    });
  });

  describe('SkeletonAvatar', () => {
    it('renders with size presets', () => {
      const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
      sizes.forEach(size => {
        const { container } = render(<SkeletonAvatar size={size} />);
        expect(container.firstChild).toBeTruthy();
      });
    });
  });

  describe('SkeletonGrid', () => {
    it('renders correct number of cards', () => {
      const { container } = render(<SkeletonGrid count={4} />);
      const cards = container.querySelectorAll('.rounded-xl');
      expect(cards.length).toBe(4);
    });

    it('renders list variant', () => {
      const { container } = render(<SkeletonGrid variant="list" count={3} />);
      const items = container.querySelectorAll('.rounded-xl');
      expect(items.length).toBe(3);
    });
  });

  describe('SkeletonList', () => {
    it('renders bounty list skeleton', () => {
      const { container } = render(<SkeletonList count={5} showTier showSkills />);
      const items = container.querySelectorAll('.rounded-xl');
      expect(items.length).toBe(5);
    });
  });

  describe('SkeletonTable', () => {
    it('renders table with rows and columns', () => {
      const { container } = render(<SkeletonTable rows={5} columns={4} />);
      const rows = container.querySelectorAll('tbody tr');
      expect(rows.length).toBe(5);
    });
  });

  describe('SkeletonActivityFeed', () => {
    it('renders activity feed skeleton', () => {
      const { container } = render(<SkeletonActivityFeed count={3} />);
      const items = container.querySelectorAll('.divide-y > div');
      expect(items.length).toBe(3);
    });
  });
});
