import React from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import type { LeaderboardEntry } from '../../types/leaderboard';
import { LANG_COLORS } from '../../lib/utils';
import { fadeIn } from '../../lib/animations';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

function SkillDot({ skill }: { skill: string }) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full"
      style={{ backgroundColor: LANG_COLORS[skill] ?? '#5C5C78' }}
      title={skill}
    />
  );
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  // Show ranks 4+ in the table (top 3 are in podium)
  const tableEntries = entries.slice(3);

  if (tableEntries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 p-8 text-center">
        <p className="text-text-muted text-sm">No additional rankings yet.</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className="max-w-4xl mx-auto mt-6 rounded-xl border border-border bg-forge-900 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-border/50 text-xs font-semibold text-text-muted uppercase tracking-wider">
        <div className="w-[60px] text-center">Rank</div>
        <div className="flex-1">User</div>
        <div className="w-[100px] text-center">Bounties</div>
        <div className="w-[120px] text-right">Earned</div>
        <div className="w-[80px] text-center hidden sm:block">Streak</div>
      </div>

      {tableEntries.map((entry) => (
        <motion.div
          key={entry.username}
          layout
          layoutId={`leaderboard-${entry.username}`}
          className="flex items-center px-4 py-3 border-b border-border/30 last:border-b-0 hover:bg-forge-850 transition-colors duration-150 cursor-pointer"
        >
          <div className="w-[60px] text-center font-mono text-sm text-text-muted">
            #{entry.rank}
          </div>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {entry.avatarUrl ? (
              <img src={entry.avatarUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-forge-700 flex-shrink-0 flex items-center justify-center">
                <span className="font-mono text-xs text-text-muted">{entry.username[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="min-w-0">
              <span className="font-sans text-sm font-medium text-text-primary truncate block">
                {entry.username}
              </span>
              {entry.topSkills?.length > 0 && (
                <div className="flex items-center gap-1 mt-0.5">
                  {entry.topSkills.slice(0, 4).map((s) => (
                    <SkillDot key={s} skill={s} />
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="w-[100px] text-center font-mono text-sm text-text-secondary">
            {entry.bountiesCompleted}
          </div>
          <div className="w-[120px] text-right font-mono text-sm font-semibold text-emerald">
            ${entry.earningsFndry.toLocaleString()}
          </div>
          <div className="w-[80px] text-center hidden sm:block">
            {entry.streak && entry.streak > 0 ? (
              <span className="font-mono text-sm text-status-warning inline-flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> {entry.streak}
              </span>
            ) : (
              <span className="text-text-muted">—</span>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
