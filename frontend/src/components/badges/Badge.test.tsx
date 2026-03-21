/**
 * Tests for Badge component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from './Badge';
import type { BadgeDefinition } from '../../types/badge';

// Mock badge definition
const mockBadge: BadgeDefinition = {
  id: 'first_blood',
  name: 'First Blood',
  icon: '🥇',
  description: 'First PR merged',
  category: 'milestone',
  requirement: 1,
};

describe('Badge', () => {
  it('renders earned badge with correct styling', () => {
    render(<Badge badge={mockBadge} earned={true} />);
    
    const badgeElement = screen.getByRole('button', { name: /First Blood.*Earned/i });
    expect(badgeElement).toBeInTheDocument();
    
    // Check for gradient styling (earned state)
    expect(badgeElement).toHaveClass('from-[#9945FF]/20');
  });

  it('renders unearned badge with locked styling', () => {
    render(<Badge badge={mockBadge} earned={false} />);
    
    const badgeElement = screen.getByRole('button', { name: /First Blood.*Not yet earned/i });
    expect(badgeElement).toBeInTheDocument();
    
    // Check for grayscale styling (locked state)
    expect(badgeElement).toHaveClass('grayscale');
  });

  it('shows badge name below icon', () => {
    render(<Badge badge={mockBadge} earned={true} />);
    
    expect(screen.getByText('First Blood')).toBeInTheDocument();
  });

  it('shows tooltip with description on hover', async () => {
    const user = userEvent.setup();
    render(<Badge badge={mockBadge} earned={true} />);
    
    const badgeElement = screen.getByRole('button', { name: /First Blood.*Earned/i });
    await user.hover(badgeElement);
    
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByText('First PR merged')).toBeInTheDocument();
  });

  it('shows earned date in tooltip for earned badges', async () => {
    const user = userEvent.setup();
    const earnedAt = '2026-03-15T10:00:00Z';
    
    render(<Badge badge={mockBadge} earned={true} earnedAt={earnedAt} />);
    
    const badgeElement = screen.getByRole('button', { name: /First Blood.*Earned/i });
    await user.hover(badgeElement);
    
    expect(screen.getByText(/Earned on/)).toBeInTheDocument();
  });

  it('shows progress bar for unearned badges with progress', async () => {
    const user = userEvent.setup();
    render(<Badge badge={mockBadge} earned={false} progress={50} />);
    
    const badgeElement = screen.getByRole('button', { name: /First Blood.*Not yet earned/i });
    await user.hover(badgeElement);
    
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders different sizes correctly', () => {
    const { rerender } = render(<Badge badge={mockBadge} earned={true} size="sm" />);
    expect(screen.getByRole('button')).toHaveClass('w-12', 'h-12');
    
    rerender(<Badge badge={mockBadge} earned={true} size="md" />);
    expect(screen.getByRole('button')).toHaveClass('w-16', 'h-16');
    
    rerender(<Badge badge={mockBadge} earned={true} size="lg" />);
    expect(screen.getByRole('button')).toHaveClass('w-20', 'h-20');
  });

  it('shows lock overlay for unearned badges', () => {
    render(<Badge badge={mockBadge} earned={false} />);
    
    // Check that the lock icon is present using specific test id
    const lockIcon = screen.getByTestId('badge-lock');
    expect(lockIcon).toBeInTheDocument();
    expect(lockIcon).toHaveAttribute('aria-label', 'Locked');
  });

  it('applies different category styles in tooltip', async () => {
    const user = userEvent.setup();
    
    const milestoneBadge = { ...mockBadge, category: 'milestone' as const };
    const { rerender } = render(<Badge badge={milestoneBadge} earned={true} />);
    
    let badgeElement = screen.getByRole('button', { name: /First Blood.*Earned/i });
    await user.hover(badgeElement);
    expect(screen.getByText('milestone')).toHaveClass('text-purple-300');
    
    const qualityBadge = { ...mockBadge, id: 'sharpshooter' as const, category: 'quality' as const };
    rerender(<Badge badge={qualityBadge} earned={true} />);
    badgeElement = screen.getByRole('button');
    await user.hover(badgeElement);
    expect(screen.getByText('quality')).toHaveClass('text-green-300');
  });
});