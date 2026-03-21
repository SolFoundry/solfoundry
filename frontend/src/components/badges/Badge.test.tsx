import { render, screen, fireEvent } from '@testing-library/react';
import { Badge } from './Badge';
import type { BadgeWithStatus } from '../../types/badges';

const earnedBadge: BadgeWithStatus = {
    id: 'first-blood',
    name: 'First Blood',
    description: 'First PR merged',
    icon: '🥇',
    isEarned: () => true,
    earned: true,
};

const lockedBadge: BadgeWithStatus = {
    id: 'diamond-hands',
    name: 'Diamond Hands',
    description: '10 PRs merged',
    icon: '💎',
    isEarned: () => false,
    earned: false,
};

describe('Badge', () => {
    it('renders with the correct test id', () => {
        render(<Badge badge={earnedBadge} />);
        expect(screen.getByTestId('profile-badge-first-blood')).toBeInTheDocument();
    });

    it('renders the badge name', () => {
        render(<Badge badge={earnedBadge} />);
        expect(screen.getByText('First Blood')).toBeInTheDocument();
    });

    it('renders the badge emoji icon', () => {
        render(<Badge badge={earnedBadge} />);
        expect(screen.getByText('🥇')).toBeInTheDocument();
    });

    it('has an accessible label including earned status', () => {
        render(<Badge badge={earnedBadge} />);
        const el = screen.getByTestId('profile-badge-first-blood');
        expect(el).toHaveAttribute('aria-label', expect.stringContaining('Earned'));
    });

    it('has an accessible label including locked status for unearned badge', () => {
        render(<Badge badge={lockedBadge} />);
        const el = screen.getByTestId('profile-badge-diamond-hands');
        expect(el).toHaveAttribute('aria-label', expect.stringContaining('Locked'));
    });

    it('shows LOCKED overlay for unearned badges', () => {
        render(<Badge badge={lockedBadge} />);
        expect(screen.getByText('LOCKED')).toBeInTheDocument();
    });

    it('does not show LOCKED overlay for earned badges', () => {
        render(<Badge badge={earnedBadge} />);
        expect(screen.queryByText('LOCKED')).not.toBeInTheDocument();
    });

    it('shows tooltip on focus', () => {
        render(<Badge badge={earnedBadge} />);
        const badgeEl = screen.getByTestId('profile-badge-first-blood');
        fireEvent.focus(badgeEl);
        expect(screen.getByRole('tooltip')).toHaveTextContent('First PR merged');
    });

    it('hides tooltip on blur', () => {
        render(<Badge badge={earnedBadge} />);
        const badgeEl = screen.getByTestId('profile-badge-first-blood');
        fireEvent.focus(badgeEl);
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        fireEvent.blur(badgeEl);
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('applies grayscale to unearned badge icon', () => {
        render(<Badge badge={lockedBadge} />);
        const icon = screen.getByText('💎');
        expect(icon.className).toContain('grayscale');
    });

    it('does not apply grayscale to earned badge icon', () => {
        render(<Badge badge={earnedBadge} />);
        const icon = screen.getByText('🥇');
        expect(icon.className).not.toContain('grayscale');
    });
});
