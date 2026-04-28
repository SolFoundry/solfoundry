import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Zap, TrendingUp } from 'lucide-react';
import type { StreakInfo } from '../../types/leaderboard';
import { popIn, fadeInScale } from '../../lib/animations';

interface StreakTrackerProps {
  streakInfo?: StreakInfo;
  streak?: number | null;  // fallback simple field
  size?: 'sm' | 'md' | 'lg';
}

// ─── Fire burst animation for active streaks ─────────────────────
function StreakFlame({ size = 16, intensity = 1 }: { size?: number; intensity?: number }) {
  return (
    <motion.div
      className="relative inline-flex items-center justify-center"
      animate={{
        scale: [1, 1.15 * intensity, 1],
        filter: [
          'brightness(1)',
          'brightness(1.3)',
          'brightness(1)',
        ],
      }}
      transition={{
        duration: 1.2 / intensity,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      <Flame
        size={size}
        className="text-orange-400"
        style={{ filter: `drop-shadow(0 0 ${4 * intensity}px rgba(251, 146, 60, 0.6))` }}
      />
      {/* Glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            `0 0 0px rgba(251, 146, 60, 0)`,
            `0 0 ${8 * intensity}px rgba(251, 146, 60, 0.4)`,
            `0 0 0px rgba(251, 146, 60, 0)`,
          ],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </motion.div>
  );
}

// ─── Streak milestone markers ────────────────────────────────────
function StreakMilestones({ current, milestones }: { current: number; milestones: number[] }) {
  return (
    <div className="flex items-center gap-1">
      {milestones.map((milestone) => {
        const achieved = current >= milestone;
        return (
          <motion.div
            key={milestone}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className={`w-2 h-2 rounded-full transition-colors ${
              achieved ? 'bg-orange-400 shadow-sm shadow-orange-400/50' : 'bg-forge-700'
            }`}
            title={`${milestone}-day streak`}
          />
        );
      })}
    </div>
  );
}

// ─── Compact inline streak display ───────────────────────────────
export function StreakBadge({ streakInfo, streak, size = 'sm' }: StreakTrackerProps) {
  const currentStreak = streakInfo?.current ?? streak ?? 0;
  const isActive = streakInfo?.isActive ?? (currentStreak > 0);
  const milestones = streakInfo?.milestones ?? [7, 14, 30, 60, 90];

  if (currentStreak <= 0) {
    return <span className="text-text-muted text-sm">—</span>;
  }

  const flameSize = size === 'sm' ? 14 : size === 'md' ? 18 : 22;
  const intensity = currentStreak >= 30 ? 1.5 : currentStreak >= 14 ? 1.2 : currentStreak >= 7 ? 1 : 0.7;

  const streakColor =
    currentStreak >= 30
      ? 'text-red-400'
      : currentStreak >= 14
      ? 'text-orange-400'
      : currentStreak >= 7
      ? 'text-yellow-400'
      : 'text-text-secondary';

  return (
    <div className="inline-flex items-center gap-1.5">
      <StreakFlame size={flameSize} intensity={intensity} />
      <motion.span
        key={currentStreak}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`font-mono font-bold ${streakColor} ${
          size === 'lg' ? 'text-lg' : size === 'md' ? 'text-sm' : 'text-sm'
        }`}
      >
        {currentStreak}
      </motion.span>
      {isActive && (
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[10px] text-orange-400 font-medium"
        >
          LIVE
        </motion.span>
      )}
    </div>
  );
}

// ─── Expanded streak card (for podium / detail view) ─────────────
export function StreakCard({ streakInfo }: { streakInfo: StreakInfo }) {
  if (!streakInfo) return null;
  const { current, longest, isActive, milestones } = streakInfo;

  const intensity = current >= 30 ? 1.5 : current >= 14 ? 1.2 : 1;
  const progressToNext = milestones.reduce((prev, m) => (current >= m ? m : prev), 0);
  const nextMilestone = milestones.find((m) => m > current) ?? milestones[milestones.length - 1];
  const progressPercent = Math.min((current / nextMilestone) * 100, 100);

  return (
    <motion.div
      variants={fadeInScale}
      initial="initial"
      animate="animate"
      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-forge-800/60 border border-orange-500/20"
    >
      <StreakFlame size={24} intensity={intensity} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">
            {current}-day streak
          </span>
          {isActive && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="flex items-center gap-1 text-[10px] text-emerald font-semibold uppercase tracking-wider"
            >
              <Zap size={10} /> Active
            </motion.span>
          )}
        </div>

        {/* Progress bar to next milestone */}
        <div className="mt-1.5 relative h-1.5 rounded-full bg-forge-700 overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-orange-500 to-yellow-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        </div>

        <div className="mt-1 flex items-center justify-between">
          <StreakMilestones current={current} milestones={milestones} />
          <span className="text-[10px] text-text-muted">
            Best: {longest}d · Next: {nextMilestone}d
          </span>
        </div>
      </div>
    </motion.div>
  );
}
