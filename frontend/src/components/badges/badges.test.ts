import {
    computeBadges,
    BADGE_DEFINITIONS,
    type ContributorBadgeStats,
    type BadgeWithStatus,
} from '../../types/badges';

function makeStats(overrides: Partial<ContributorBadgeStats> = {}): ContributorBadgeStats {
    return {
        mergedPrCount: 0,
        mergedWithoutRevisionCount: 0,
        isTopContributorThisMonth: false,
        prSubmissionTimestampsUtc: [],
        ...overrides,
    };
}

function findBadge(badges: BadgeWithStatus[], id: string) {
    return badges.find((b) => b.id === id)!;
}

describe('computeBadges', () => {
    it('returns all badge definitions', () => {
        const badges = computeBadges(makeStats());
        expect(badges).toHaveLength(BADGE_DEFINITIONS.length);
    });

    it('marks all badges as unearned for a fresh contributor', () => {
        const badges = computeBadges(makeStats());
        expect(badges.every((b) => !b.earned)).toBe(true);
    });

    // First Blood
    it('earns First Blood at 1 merged PR', () => {
        const badges = computeBadges(makeStats({ mergedPrCount: 1 }));
        expect(findBadge(badges, 'first-blood').earned).toBe(true);
    });

    it('does not earn First Blood at 0 merged PRs', () => {
        const badges = computeBadges(makeStats({ mergedPrCount: 0 }));
        expect(findBadge(badges, 'first-blood').earned).toBe(false);
    });

    // On Fire
    it('earns On Fire at 3 merged PRs', () => {
        const badges = computeBadges(makeStats({ mergedPrCount: 3 }));
        expect(findBadge(badges, 'on-fire').earned).toBe(true);
    });

    it('does not earn On Fire at 2 merged PRs', () => {
        const badges = computeBadges(makeStats({ mergedPrCount: 2 }));
        expect(findBadge(badges, 'on-fire').earned).toBe(false);
    });

    // Rising Star
    it('earns Rising Star at 5 merged PRs', () => {
        const badges = computeBadges(makeStats({ mergedPrCount: 5 }));
        expect(findBadge(badges, 'rising-star').earned).toBe(true);
    });

    // Diamond Hands
    it('earns Diamond Hands at 10 merged PRs', () => {
        const badges = computeBadges(makeStats({ mergedPrCount: 10 }));
        expect(findBadge(badges, 'diamond-hands').earned).toBe(true);
    });

    it('does not earn Diamond Hands at 9 merged PRs', () => {
        const badges = computeBadges(makeStats({ mergedPrCount: 9 }));
        expect(findBadge(badges, 'diamond-hands').earned).toBe(false);
    });

    // Top Contributor
    it('earns Top Contributor when flagged', () => {
        const badges = computeBadges(makeStats({ isTopContributorThisMonth: true }));
        expect(findBadge(badges, 'top-contributor').earned).toBe(true);
    });

    it('does not earn Top Contributor when not flagged', () => {
        const badges = computeBadges(makeStats({ isTopContributorThisMonth: false }));
        expect(findBadge(badges, 'top-contributor').earned).toBe(false);
    });

    // Sharpshooter
    it('earns Sharpshooter at 3 no-revision PRs', () => {
        const badges = computeBadges(makeStats({ mergedWithoutRevisionCount: 3 }));
        expect(findBadge(badges, 'sharpshooter').earned).toBe(true);
    });

    it('does not earn Sharpshooter at 2 no-revision PRs', () => {
        const badges = computeBadges(makeStats({ mergedWithoutRevisionCount: 2 }));
        expect(findBadge(badges, 'sharpshooter').earned).toBe(false);
    });

    // Night Owl
    it('earns Night Owl with a PR between midnight and 5am UTC', () => {
        const badges = computeBadges(
            makeStats({ prSubmissionTimestampsUtc: ['2026-03-15T02:30:00Z'] }),
        );
        expect(findBadge(badges, 'night-owl').earned).toBe(true);
    });

    it('earns Night Owl at exactly midnight UTC', () => {
        const badges = computeBadges(
            makeStats({ prSubmissionTimestampsUtc: ['2026-03-15T00:00:00Z'] }),
        );
        expect(findBadge(badges, 'night-owl').earned).toBe(true);
    });

    it('does not earn Night Owl at 5:00am UTC (boundary)', () => {
        const badges = computeBadges(
            makeStats({ prSubmissionTimestampsUtc: ['2026-03-15T05:00:00Z'] }),
        );
        expect(findBadge(badges, 'night-owl').earned).toBe(false);
    });

    it('does not earn Night Owl with only daytime PRs', () => {
        const badges = computeBadges(
            makeStats({ prSubmissionTimestampsUtc: ['2026-03-15T14:00:00Z', '2026-03-16T10:00:00Z'] }),
        );
        expect(findBadge(badges, 'night-owl').earned).toBe(false);
    });

    it('does not earn Night Owl with an invalid timestamp', () => {
        const badges = computeBadges(
            makeStats({ prSubmissionTimestampsUtc: ['not-a-date'] }),
        );
        expect(findBadge(badges, 'night-owl').earned).toBe(false);
    });

    // Multiple badges at once
    it('earns multiple badges simultaneously', () => {
        const badges = computeBadges(
            makeStats({
                mergedPrCount: 10,
                mergedWithoutRevisionCount: 5,
                isTopContributorThisMonth: true,
                prSubmissionTimestampsUtc: ['2026-03-15T03:00:00Z'],
            }),
        );
        expect(badges.filter((b) => b.earned)).toHaveLength(7); // All badges earned
    });
});
