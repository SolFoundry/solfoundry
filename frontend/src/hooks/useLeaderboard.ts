/**
 * useLeaderboard - Data-fetching hook for the contributor leaderboard.
 * Tries GET /api/leaderboard, falls back to GitHub API for merged PRs,
 * merges with known Phase 1 payout data.
 * @module hooks/useLeaderboard
 */
import { useState, useEffect, useMemo } from 'react';
import type { Contributor, TimeRange, SortField } from '../types/leaderboard';

const REPO = 'SolFoundry/solfoundry';
const GITHUB_API = 'https://api.github.com';

/** Known Phase 1 payout data (on-chain payouts). */
const KNOWN_PAYOUTS: Record<string, { bounties: number; fndry: number; skills: string[] }> = {
  HuiNeng6: { bounties: 12, fndry: 1_800_000, skills: ['Python', 'FastAPI', 'React', 'TypeScript', 'WebSocket'] },
  ItachiDevv: { bounties: 8, fndry: 1_750_000, skills: ['React', 'TypeScript', 'Tailwind', 'Solana'] },
  LaphoqueRC: { bounties: 1, fndry: 150_000, skills: ['Frontend', 'React'] },
  zhaog100: { bounties: 1, fndry: 150_000, skills: ['Backend', 'Python', 'FastAPI'] },
};

/** Fetch merged PRs from GitHub to build contributor stats. */
async function fetchGitHubContributors(): Promise<Contributor[]> {
  const url = `${GITHUB_API}/repos/${REPO}/pulls?state=closed&per_page=100&sort=updated&direction=desc`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const prs = await res.json();
  if (!Array.isArray(prs)) return [];

  // Count merged PRs per author
  const stats: Record<string, { prs: number; avatar: string }> = {};
  for (const pr of prs) {
    if (!pr.merged_at) continue;
    const login = pr.user?.login;
    if (!login || login.includes('[bot]')) continue;
    if (!stats[login]) stats[login] = { prs: 0, avatar: pr.user.avatar_url || '' };
    stats[login].prs++;
  }

  // Merge with known payout data
  const allAuthors = new Set([...Object.keys(KNOWN_PAYOUTS), ...Object.keys(stats)]);
  const contributors: Contributor[] = [];

  for (const author of allAuthors) {
    const known = KNOWN_PAYOUTS[author];
    const prData = stats[author];
    const totalPrs = prData?.prs || 0;
    const bounties = known?.bounties || totalPrs;
    const earnings = known?.fndry || 0;
    const skills = known?.skills || [];
    const avatar = prData?.avatar || `https://avatars.githubusercontent.com/${author}`;

    // Reputation score
    let rep = 0;
    rep += Math.min(totalPrs * 5, 40);
    rep += Math.min(bounties * 5, 40);
    rep += Math.min(skills.length * 3, 20);
    rep = Math.min(rep, 100);

    contributors.push({
      rank: 0,
      username: author,
      avatarUrl: avatar,
      points: rep * 100 + bounties * 50,
      bountiesCompleted: bounties,
      earningsFndry: earnings,
      earningsSol: 0,
      streak: Math.max(1, Math.floor(bounties / 2)),
      topSkills: skills.slice(0, 3),
    });
  }

  return contributors;
}

export function useLeaderboard() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [sortBy, setSortBy] = useState<SortField>('points');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        // Try backend API first
        const r = await fetch(`/api/leaderboard?range=${timeRange}`);
        if (!c && r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            setContributors(data);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Backend unavailable — fall through to GitHub
      }

      try {
        // Fallback: build from GitHub API + known payouts
        const contribs = await fetchGitHubContributors();
        if (!c && contribs.length > 0) {
          setContributors(contribs);
        }
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => { c = true; };
  }, [timeRange]);

  const sorted = useMemo(() => {
    let list = [...contributors];
    if (search) list = list.filter(c => c.username.toLowerCase().includes(search.toLowerCase()));
    list.sort((a, b) => {
      const aValue = sortBy === 'bounties' ? a.bountiesCompleted : sortBy === 'earnings' ? a.earningsFndry : a.points;
      const bValue = sortBy === 'bounties' ? b.bountiesCompleted : sortBy === 'earnings' ? b.earningsFndry : b.points;
      return bValue - aValue;
    });
    return list.map((c, i) => ({ ...c, rank: i + 1 }));
  }, [contributors, sortBy, search]);

  return { contributors: sorted, loading, error, timeRange, setTimeRange, sortBy, setSortBy, search, setSearch };
}
