import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Bounty, Submission } from '../../types/bounty';
import { fadeIn } from '../../lib/animations';
import { useGitHubActivity } from '../../hooks/useGitHubActivity';
import { GitHubActivityGraph } from './GitHubActivityGraph';
import { EarningsHistoryChart } from './EarningsHistoryChart';
import { StatsRow, type ContributorStats } from './StatsRow';

interface Props {
  username: string | null | undefined;
  /** Submissions the contributor has made (any status). */
  submissions: Submission[];
  /** Bounties the contributor is associated with (creator or submitter). */
  bounties: Bounty[];
}

function buildBountyIndex(bounties: Bounty[]): Map<string, Bounty> {
  const m = new Map<string, Bounty>();
  for (const b of bounties) m.set(b.id, b);
  return m;
}

export function ContributorStatsPanel({ username, submissions, bounties }: Props) {
  const { data: activity, isLoading: activityLoading } = useGitHubActivity(username, 90);

  const bountiesById = useMemo(() => buildBountyIndex(bounties), [bounties]);

  const paidSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'approved'),
    [submissions],
  );

  const stats: ContributorStats = useMemo(() => {
    let totalEarnedUsdc = 0;
    let totalEarnedFndry = 0;
    for (const sub of paidSubmissions) {
      const bounty = bountiesById.get(sub.bounty_id);
      const earned = sub.earned ?? bounty?.reward_amount ?? 0;
      if (!earned) continue;
      if (bounty?.reward_token === 'FNDRY') totalEarnedFndry += earned;
      else totalEarnedUsdc += earned;
    }
    return {
      totalEarnedUsdc,
      totalEarnedFndry,
      bountiesCompleted: paidSubmissions.length,
      currentStreakDays: activity?.currentStreak ?? 0,
      longestStreakDays: activity?.longestStreak ?? 0,
      recentActivityCount: activity?.counts.total ?? 0,
    };
  }, [paidSubmissions, bountiesById, activity]);

  return (
    <motion.section
      variants={fadeIn}
      initial="initial"
      animate="animate"
      aria-label="Contributor statistics"
      className="space-y-4"
    >
      <StatsRow stats={stats} />
      <GitHubActivityGraph activity={activity} loading={activityLoading} username={username} />
      <EarningsHistoryChart paidSubmissions={paidSubmissions} bountiesById={bountiesById} />
    </motion.section>
  );
}
