/**
 * BadgeGrid — Displays all badges in a responsive grid, earned badges first.
 * Shows a header with the earned badge count and a summary line.
 * @module BadgeGrid
 */
import type { BadgeWithStatus } from '../../types/badges';
import { Badge } from './Badge';

interface BadgeGridProps {
    /** List of badges (earned + unearned). */
    badges: BadgeWithStatus[];
    /** Optional title, defaults to "Achievements". */
    title?: string;
    /** If true, render a compact inline variant (no section border). */
    compact?: boolean;
}

export function BadgeGrid({
    badges,
    title = 'Achievements',
    compact = false,
}: BadgeGridProps) {
    const earned = badges.filter((b) => b.earned);
    const locked = badges.filter((b) => !b.earned);

    // Show earned badges first, then locked
    const sorted = [...earned, ...locked];

    if (compact) {
        return (
            <div data-testid="badge-grid">
                {/* Inline badge count */}
                <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <span
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-2 py-0.5 text-[10px] font-bold text-white leading-none"
                        data-testid="badge-count"
                    >
                        {earned.length}/{badges.length}
                    </span>
                </div>

                <div
                    role="list"
                    className="grid grid-cols-3 sm:grid-cols-4 gap-2"
                >
                    {sorted.map((badge, i) => (
                        <Badge key={badge.id} badge={badge} index={i} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div
            className="rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-surface-50 p-4 sm:p-6"
            data-testid="badge-grid"
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
                    <span
                        className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] px-2.5 py-0.5 text-xs font-bold text-white"
                        data-testid="badge-count"
                    >
                        {earned.length}/{badges.length}
                    </span>
                </div>

                {/* Progress bar */}
                <div className="hidden sm:flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                        {earned.length === badges.length
                            ? '🎉 All unlocked!'
                            : `${badges.length - earned.length} remaining`}
                    </span>
                    <div className="w-24 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-700"
                            style={{
                                width: `${badges.length > 0
                                        ? (earned.length / badges.length) * 100
                                        : 0
                                    }%`,
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div
                role="list"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3"
            >
                {sorted.map((badge, i) => (
                    <Badge key={badge.id} badge={badge} index={i} />
                ))}
            </div>

            {/* Empty state */}
            {badges.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="text-4xl mb-3">🏅</span>
                    <p className="text-gray-400 text-sm">
                        No badges available yet. Start contributing to earn achievements!
                    </p>
                </div>
            )}
        </div>
    );
}
