import { Bounty, LeaderboardEntry, PlatformStats } from './types';

export function formatBountyCard(bounty: Bounty): string {
  const tierEmoji: Record<string, string> = { T0: '🔴', T1: '🟠', T2: '🟡', T3: '🟢' };
  const statusEmoji: Record<string, string> = { open: '🟢', in_progress: '🟡', completed: '✅', cancelled: '❌' };
  return [
    `${tierEmoji[bounty.tier] || '⚪'} *${bounty.title}*`,
    `💰 Reward: ${bounty.reward} ${bounty.token}`,
    `🏷 Tier: ${bounty.tier} | ${statusEmoji[bounty.status] || ''} ${bounty.status}`,
    bounty.skills?.length ? `🔧 Skills: ${bounty.skills.join(', ')}` : '',
    `📅 Deadline: ${bounty.deadline || 'No deadline'}`,
  ].filter(Boolean).join('\n');
}

export function formatBountyDetail(bounty: Bounty): string {
  return [
    `📋 *${bounty.title}*`,
    '',
    bounty.description,
    '',
    `💰 *Reward:* ${bounty.reward} ${bounty.token}`,
    `🏷 *Tier:* ${bounty.tier}`,
    `📊 *Status:* ${bounty.status}`,
    bounty.skills?.length ? `🔧 *Skills:* ${bounty.skills.join(', ')}` : '',
    bounty.assignee ? `👤 *Assignee:* ${bounty.assignee}` : '',
    `📅 *Created:* ${bounty.created_at}`,
    bounty.deadline ? `⏰ *Deadline:* ${bounty.deadline}` : '',
    `🔗 [View on SolFoundry](${bounty.url})`,
  ].filter(Boolean).join('\n');
}

export function formatLeaderboard(entries: LeaderboardEntry[]): string {
  if (!entries.length) return '🏆 No leaderboard data available.';
  const medals = ['🥇', '🥈', '🥉'];
  const rows = entries.slice(0, 10).map((e, i) => {
    const medal = medals[i] || `${e.rank}.`;
    return `${medal} @${e.username} — ${e.bounties_completed} bounties — ${e.total_earned}`;
  });
  return `🏆 *Leaderboard*\n\n${rows.join('\n')}`;
}

export function formatStats(stats: PlatformStats): string {
  return [
    '📊 *SolFoundry Platform Stats*',
    '',
    `📦 Total Bounties: ${stats.total_bounties}`,
    `🟢 Open Bounties: ${stats.open_bounties}`,
    `✅ Completed: ${stats.bounties_completed}`,
    `💰 Total Reward Pool: ${stats.total_reward_pool}`,
    `👥 Contributors: ${stats.total_contributors}`,
  ].join('\n');
}

export function formatNotification(bounty: Bounty): string {
  return [
    '🆕 *New Bounty Alert!*',
    '',
    formatBountyCard(bounty),
    '',
    `🔗 [View & Claim](${bounty.url})`,
  ].join('\n');
}
