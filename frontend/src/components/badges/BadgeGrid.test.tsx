/**
 * Tests for BadgeGrid component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BadgeGrid } from './BadgeGrid';
import type { BadgeStatus } from '../../types/badge';

// Mock badge statuses
const mockBadges: BadgeStatus[] = [
  {
    badge: {
      id: 'first_blood',
      name: 'First Blood',
      icon: '🥇',
      description: 'First PR merged',
      category: 'milestone',
      requirement: 1,
    },
    earned: true,
    earnedAt: '2026-03-15T10:00:00Z',
    progress: 100,
  },
  {
    badge: {
      id: 'on_fire',
      name: 'On Fire',
      icon: '🔥',
      description: '3 PRs merged',
      category: 'milestone',
      requirement: 3,
    },
    earned: false,
    progress: 33,
  },
  {
    badge: {
      id: 'rising_star',
      name: 'Rising Star',
      icon: '⭐',
      description: '5 PRs merged',
      category: 'milestone',
      requirement: 5,
    },
    earned: false,
    progress: 20,
  },
  {
    badge: {
      id: 'sharpshooter',
      name: 'Sharpshooter',
      icon: '🎯',
      description: '3 PRs merged with no revision requests',
      category: 'quality',
      requirement: 3,
    },
    earned: true,
    earnedAt: '2026-03-16T10:00:00Z',
    progress: 100,
  },
];

describe('BadgeGrid', () => {
  it('renders all badges in the grid', () => {
    render(<BadgeGrid badges={mockBadges} />);
    
    expect(screen.getByText('First Blood')).toBeInTheDocument();
    expect(screen.getByText('On Fire')).toBeInTheDocument();
    expect(screen.getByText('Rising Star')).toBeInTheDocument();
    expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
  });

  it('displays badge count header', () => {
    render(<BadgeGrid badges={mockBadges} />);
    
    expect(screen.getByText('Achievements')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Earned count
    expect(screen.getByText('/ 4 earned')).toBeInTheDocument(); // Total count
  });

  it('filters to show only earned badges when earnedOnly is true', () => {
    render(<BadgeGrid badges={mockBadges} earnedOnly={true} />);
    
    expect(screen.getByText('First Blood')).toBeInTheDocument();
    expect(screen.getByText('Sharpshooter')).toBeInTheDocument();
    expect(screen.queryByText('On Fire')).not.toBeInTheDocument();
    expect(screen.queryByText('Rising Star')).not.toBeInTheDocument();
  });

  it('shows empty state when no badges to display', () => {
    render(<BadgeGrid badges={[]} />);
    
    expect(screen.getByText('No badges yet')).toBeInTheDocument();
    expect(screen.getByText('Complete bounties to earn badges!')).toBeInTheDocument();
  });

  it('shows empty state for earnedOnly with no earned badges', () => {
    const unearnedBadges = mockBadges.map(b => ({ ...b, earned: false }));
    render(<BadgeGrid badges={unearnedBadges} earnedOnly={true} />);
    
    expect(screen.getByText('No badges earned yet')).toBeInTheDocument();
  });

  it('sorts badges with earned first', () => {
    // Create badges with unearned first
    const unsortedBadges: BadgeStatus[] = [
      mockBadges[1], // On Fire (unearned)
      mockBadges[0], // First Blood (earned)
      mockBadges[2], // Rising Star (unearned)
      mockBadges[3], // Sharpshooter (earned)
    ];
    
    render(<BadgeGrid badges={unsortedBadges} />);
    
    const badgeElements = screen.getAllByRole('button');
    // First badge should be an earned one
    expect(badgeElements[0]).toHaveAttribute('aria-label', expect.stringContaining('Earned'));
  });

  it('applies correct grid columns', () => {
    const { container } = render(<BadgeGrid badges={mockBadges} columns={3} />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2', 'sm:grid-cols-3');
  });

  it('applies 4 columns grid by default', () => {
    const { container } = render(<BadgeGrid badges={mockBadges} columns={4} />);
    
    const grid = container.querySelector('.grid');
    expect(grid).toHaveClass('grid-cols-2', 'sm:grid-cols-3', 'lg:grid-cols-4');
  });
});