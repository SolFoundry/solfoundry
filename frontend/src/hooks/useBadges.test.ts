/**
 * Tests for useBadges hook.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBadges, useBadgeCount } from './useBadges';
import { BADGE_DEFINITIONS } from '../config/badges';
import type { ContributorStats } from '../types/badge';

describe('useBadges', () => {
  it('returns all badges as unearned when stats is null', () => {
    const { result } = renderHook(() => useBadges(null));
    
    expect(result.current).toHaveLength(BADGE_DEFINITIONS.length); // Use dynamic badge count
    result.current.forEach(badge => {
      expect(badge.earned).toBe(false);
      expect(badge.progress).toBe(0);
    });
  });

  it('earns First Blood badge with 1 merged PR', () => {
    const stats: ContributorStats = {
      mergedPRCount: 1,
      cleanMergeCount: 0,
      prsThisMonth: 1,
      topMonthlyPRCount: 1,
      nightOwlPRs: 0,
      prTimestamps: ['2026-03-15T10:00:00Z'],
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const firstBloodBadge = result.current.find(b => b.badge.id === 'first_blood');
    expect(firstBloodBadge?.earned).toBe(true);
    expect(firstBloodBadge?.progress).toBe(100);
  });

  it('earns On Fire badge with 3 merged PRs', () => {
    const stats: ContributorStats = {
      mergedPRCount: 3,
      cleanMergeCount: 0,
      prsThisMonth: 3,
      topMonthlyPRCount: 3,
      nightOwlPRs: 0,
      prTimestamps: ['2026-03-01T10:00:00Z', '2026-03-10T10:00:00Z', '2026-03-15T10:00:00Z'],
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const onFireBadge = result.current.find(b => b.badge.id === 'on_fire');
    expect(onFireBadge?.earned).toBe(true);
    
    // First Blood should also be earned
    const firstBloodBadge = result.current.find(b => b.badge.id === 'first_blood');
    expect(firstBloodBadge?.earned).toBe(true);
  });

  it('earns Rising Star badge with 5 merged PRs', () => {
    const stats: ContributorStats = {
      mergedPRCount: 5,
      cleanMergeCount: 0,
      prsThisMonth: 5,
      topMonthlyPRCount: 5,
      nightOwlPRs: 0,
      prTimestamps: Array(5).fill('2026-03-15T10:00:00Z'),
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const risingStarBadge = result.current.find(b => b.badge.id === 'rising_star');
    expect(risingStarBadge?.earned).toBe(true);
  });

  it('earns Diamond Hands badge with 10 merged PRs', () => {
    const stats: ContributorStats = {
      mergedPRCount: 10,
      cleanMergeCount: 0,
      prsThisMonth: 10,
      topMonthlyPRCount: 10,
      nightOwlPRs: 0,
      prTimestamps: Array(10).fill('2026-03-15T10:00:00Z'),
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const diamondHandsBadge = result.current.find(b => b.badge.id === 'diamond_hands');
    expect(diamondHandsBadge?.earned).toBe(true);
  });

  it('earns Top Contributor badge when having most PRs in month', () => {
    const stats: ContributorStats = {
      mergedPRCount: 5,
      cleanMergeCount: 0,
      prsThisMonth: 5,
      topMonthlyPRCount: 5, // Has the most
      nightOwlPRs: 0,
      prTimestamps: Array(5).fill('2026-03-15T10:00:00Z'),
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const topContributorBadge = result.current.find(b => b.badge.id === 'top_contributor');
    expect(topContributorBadge?.earned).toBe(true);
  });

  it('does not earn Top Contributor when not having most PRs', () => {
    const stats: ContributorStats = {
      mergedPRCount: 5,
      cleanMergeCount: 0,
      prsThisMonth: 5,
      topMonthlyPRCount: 10, // Someone else has more
      nightOwlPRs: 0,
      prTimestamps: Array(5).fill('2026-03-15T10:00:00Z'),
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const topContributorBadge = result.current.find(b => b.badge.id === 'top_contributor');
    expect(topContributorBadge?.earned).toBe(false);
    expect(topContributorBadge?.progress).toBe(50); // 5/10 = 50%
  });

  it('earns Sharpshooter badge with 3 clean merges', () => {
    const stats: ContributorStats = {
      mergedPRCount: 3,
      cleanMergeCount: 3,
      prsThisMonth: 3,
      topMonthlyPRCount: 3,
      nightOwlPRs: 0,
      prTimestamps: Array(3).fill('2026-03-15T10:00:00Z'),
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const sharpshooterBadge = result.current.find(b => b.badge.id === 'sharpshooter');
    expect(sharpshooterBadge?.earned).toBe(true);
  });

  it('earns Night Owl badge with PR between midnight and 5am UTC', () => {
    const stats: ContributorStats = {
      mergedPRCount: 1,
      cleanMergeCount: 0,
      prsThisMonth: 1,
      topMonthlyPRCount: 1,
      nightOwlPRs: 1, // PR submitted at night
      prTimestamps: ['2026-03-15T02:00:00Z'], // 2am UTC
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const nightOwlBadge = result.current.find(b => b.badge.id === 'night_owl');
    expect(nightOwlBadge?.earned).toBe(true);
  });

  it('calculates progress correctly for unearned badges', () => {
    const stats: ContributorStats = {
      mergedPRCount: 2,
      cleanMergeCount: 1,
      prsThisMonth: 2,
      topMonthlyPRCount: 5,
      nightOwlPRs: 0,
      prTimestamps: ['2026-03-01T10:00:00Z', '2026-03-15T10:00:00Z'],
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    // On Fire requires 3 PRs, has 2 = 66.67% progress
    const onFireBadge = result.current.find(b => b.badge.id === 'on_fire');
    expect(onFireBadge?.earned).toBe(false);
    expect(Math.round(onFireBadge?.progress ?? 0)).toBe(67);
    
    // Rising Star requires 5 PRs, has 2 = 40% progress
    const risingStarBadge = result.current.find(b => b.badge.id === 'rising_star');
    expect(risingStarBadge?.earned).toBe(false);
    expect(risingStarBadge?.progress).toBe(40);
  });

  it('sets earnedAt timestamp for earned badges', () => {
    const stats: ContributorStats = {
      mergedPRCount: 3,
      cleanMergeCount: 0,
      prsThisMonth: 3,
      topMonthlyPRCount: 3,
      nightOwlPRs: 0,
      prTimestamps: ['2026-03-01T10:00:00Z', '2026-03-10T10:00:00Z', '2026-03-15T10:00:00Z'],
    };
    
    const { result } = renderHook(() => useBadges(stats));
    
    const onFireBadge = result.current.find(b => b.badge.id === 'on_fire');
    expect(onFireBadge?.earnedAt).toBe('2026-03-15T10:00:00Z'); // 3rd PR timestamp
  });
});

describe('useBadgeCount', () => {
  it('counts earned badges correctly', () => {
    const badges = [
      { badge: { id: 'a' } as any, earned: true },
      { badge: { id: 'b' } as any, earned: false },
      { badge: { id: 'c' } as any, earned: true },
    ];
    
    const { result } = renderHook(() => useBadgeCount(badges));
    
    expect(result.current.earned).toBe(2);
    expect(result.current.total).toBe(3);
  });

  it('returns zero for empty array', () => {
    const { result } = renderHook(() => useBadgeCount([]));
    
    expect(result.current.earned).toBe(0);
    expect(result.current.total).toBe(0);
  });
});