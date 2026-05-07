import React from 'react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem } from '../../lib/animations';

interface GitHubStats {
  commits: number;
  prs: number;
  issues: number;
  streak: number;
}

export function GitHubActivityGraph({ stats }: { stats: GitHubStats }) {
  // Simplified heatmap representation
  const days = Array.from({ length: 28 }, (_, i) => ({
    level: Math.floor(Math.random() * 4),
    date: `2026-04-${i + 1}`
  }));

  const getLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-emerald/30';
      case 2: return 'bg-emerald/60';
      case 3: return 'bg-emerald';
      default: return 'bg-forge-800';
    }
  };

  return (
    <motion.div 
      variants={staggerContainer} 
      initial="initial" 
      animate="animate"
      className="rounded-xl border border-border bg-forge-900 p-5 mt-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-sans text-base font-semibold text-text-primary">GitHub Contributions</h3>
        <span className="text-xs text-text-muted font-mono">{stats.streak} day streak 🔥</span>
      </div>
      
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => (
          <motion.div
            key={i}
            variants={staggerItem}
            className={`h-4 w-full rounded-sm ${getLevelColor(day.level)}`}
            title={day.date}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 border-t border-border pt-4">
        <div className="text-center">
          <p className="text-xs text-text-muted mb-1">Commits</p>
          <p className="font-mono text-lg font-bold text-text-primary">{stats.commits}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted mb-1">Pull Requests</p>
          <p className="font-mono text-lg font-bold text-emerald">{stats.prs}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-text-muted mb-1">Issues</p>
          <p className="font-mono text-lg font-bold text-magenta">{stats.issues}</p>
        </div>
      </div>
    </motion.div>
  );
}
