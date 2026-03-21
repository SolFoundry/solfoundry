import { render, screen } from '@testing-library/react';
import { BadgeGrid } from './BadgeGrid';
import type { BadgeWithStatus } from '../../types/badges';

function makeBadge(
    overrides: Partial<BadgeWithStatus> & { id: string },
): BadgeWithStatus {
    return {
        name: overrides.id,
        description: `Description for ${overrides.id}`,
        icon: '🏅',
        isEarned: () => overrides.earned ?? false,
        earned: false,
        ...overrides,
    };
}

const allBadges: BadgeWithStatus[] = [
    makeBadge({ id: 'first-blood', name: 'First Blood', icon: '🥇', earned: true }),
    makeBadge({ id: 'on-fire', name: 'On Fire', icon: '🔥', earned: true }),
    makeBadge({ id: 'rising-star', name: 'Rising Star', icon: '⭐', earned: false }),
    makeBadge({ id: 'diamond-hands', name: 'Diamond Hands', icon: '💎', earned: false }),
    makeBadge({ id: 'top-contributor', name: 'Top Contributor', icon: '🏆', earned: false }),
    makeBadge({ id: 'sharpshooter', name: 'Sharpshooter', icon: '🎯', earned: true }),
    makeBadge({ id: 'night-owl', name: 'Night Owl', icon: '🌙', earned: false }),
];

describe('BadgeGrid', () => {
    it('renders the grid container', () => {
        render(<BadgeGrid badges={allBadges} />);
        expect(screen.getByTestId('badge-grid')).toBeInTheDocument();
    });

    it('renders all badges', () => {
        render(<BadgeGrid badges={allBadges} />);
        expect(screen.getByTestId('profile-badge-first-blood')).toBeInTheDocument();
        expect(screen.getByTestId('profile-badge-on-fire')).toBeInTheDocument();
        expect(screen.getByTestId('profile-badge-rising-star')).toBeInTheDocument();
        expect(screen.getByTestId('profile-badge-diamond-hands')).toBeInTheDocument();
        expect(screen.getByTestId('profile-badge-top-contributor')).toBeInTheDocument();
        expect(screen.getByTestId('profile-badge-sharpshooter')).toBeInTheDocument();
        expect(screen.getByTestId('profile-badge-night-owl')).toBeInTheDocument();
    });

    it('displays the earned/total badge count', () => {
        render(<BadgeGrid badges={allBadges} />);
        expect(screen.getByTestId('badge-count')).toHaveTextContent('3/7');
    });

    it('shows "remaining" text when not all earned', () => {
        render(<BadgeGrid badges={allBadges} />);
        expect(screen.getByText('4 remaining')).toBeInTheDocument();
    });

    it('shows "All unlocked!" when all earned', () => {
        const allEarned = allBadges.map((b) => ({ ...b, earned: true }));
        render(<BadgeGrid badges={allEarned} />);
        expect(screen.getByText('🎉 All unlocked!')).toBeInTheDocument();
    });

    it('renders custom title', () => {
        render(<BadgeGrid badges={allBadges} title="My Badges" />);
        expect(screen.getByText('My Badges')).toBeInTheDocument();
    });

    it('renders default title "Achievements"', () => {
        render(<BadgeGrid badges={allBadges} />);
        expect(screen.getByText('Achievements')).toBeInTheDocument();
    });

    it('shows empty state when no badges', () => {
        render(<BadgeGrid badges={[]} />);
        expect(screen.getByText(/No badges available/)).toBeInTheDocument();
    });

    it('renders compact variant', () => {
        render(<BadgeGrid badges={allBadges} compact />);
        const grid = screen.getByTestId('badge-grid');
        expect(grid).toBeInTheDocument();
        expect(screen.getByTestId('badge-count')).toHaveTextContent('3/7');
    });

    it('places earned badges before locked ones in DOM order', () => {
        render(<BadgeGrid badges={allBadges} />);
        const items = screen.getAllByRole('listitem');
        // First 3 should be earned
        expect(items[0]).toHaveAttribute('aria-label', expect.stringContaining('Earned'));
        expect(items[1]).toHaveAttribute('aria-label', expect.stringContaining('Earned'));
        expect(items[2]).toHaveAttribute('aria-label', expect.stringContaining('Earned'));
        // Next 4 should be locked
        expect(items[3]).toHaveAttribute('aria-label', expect.stringContaining('Locked'));
        expect(items[4]).toHaveAttribute('aria-label', expect.stringContaining('Locked'));
        expect(items[5]).toHaveAttribute('aria-label', expect.stringContaining('Locked'));
        expect(items[6]).toHaveAttribute('aria-label', expect.stringContaining('Locked'));
    });
});
