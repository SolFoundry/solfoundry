import React from 'react';
import { motion } from 'framer-motion';
import { GitPullRequest, DollarSign, Trophy, Zap, Target, TrendingUp } from 'lucide-react';

interface ProfileStats {
  totalBounties: number;
  completedBounties: number;
  totalEarned: string;
  rank: number;
  streak: number;
  avgReviewScore: number;
  successRate: number;
  skills: { name: string; count: number }[];
  recentActivity: { type: string; description: string; date: string }[];
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="bg-forge-900 border border-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={color + ' p-2 rounded-lg'}>{icon}</div>
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className="text-xl font-bold text-text-primary font-mono">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

export function ProfileStatsDashboard({ stats }: { stats: ProfileStats }) {
  return (
    <div className="space-y-6">
      {/* Overview Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={<GitPullRequest className="w-5 h-5" />} label="Completed" value={stats.completedBounties} color="bg-emerald/10 text-emerald" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Earned" value={stats.totalEarned} color="bg-purple/10 text-purple" />
        <StatCard icon={<Trophy className="w-5 h-5" />} label="Rank" value={'#' + stats.rank} color="bg-magenta/10 text-magenta" />
        <StatCard icon={<Zap className="w-5 h-5" />} label="Streak" value={stats.streak + ' days'} color="bg-status-warning/10 text-status-warning" />
        <StatCard icon={<Target className="w-5 h-5" />} label="Success" value={stats.successRate + '%'} color="bg-status-info/10 text-status-info" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Avg Score" value={stats.avgReviewScore} color="bg-emerald/10 text-emerald" />
      </div>
      
      {/* Skills */}
      <div className="bg-forge-900 border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Skills & Contributions</h3>
        <div className="flex flex-wrap gap-2">
          {stats.skills.map(s => (
            <span key={s.name} className="inline-flex items-center gap-1.5 bg-forge-800 border border-border/50 rounded-full px-3 py-1 text-xs">
              <span className="text-text-primary">{s.name}</span>
              <span className="text-text-muted">({s.count})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}