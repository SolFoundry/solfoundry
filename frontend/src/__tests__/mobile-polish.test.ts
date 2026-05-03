import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('mobile responsive polish', () => {
  it('allows bounty card metadata and rewards to wrap on small screens', () => {
    const bountyCard = source('../components/bounty/BountyCard.tsx');
    expect(bountyCard).toContain('flex flex-wrap items-center gap-2 sm:gap-3');
    expect(bountyCard).toContain('flex flex-col gap-3 sm:flex-row');
  });

  it('keeps dense leaderboard rows scrollable on narrow viewports', () => {
    const leaderboardTable = source('../components/leaderboard/LeaderboardTable.tsx');
    expect(leaderboardTable).toContain('overflow-x-auto');
    expect(leaderboardTable).toContain('min-w-[520px]');
  });

  it('stacks payment controls and wizard actions on mobile', () => {
    const wizard = source('../components/bounty/BountyCreateWizard.tsx');
    expect(wizard).toContain('flex flex-col gap-2 sm:flex-row sm:items-center');
    expect(wizard).toContain('flex flex-col-reverse gap-3 sm:flex-row sm:justify-between');
  });
});
