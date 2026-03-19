'use client';

import React from 'react';
import { Bounty } from '@/data/mockBounties';

interface BountyCardProps {
  bounty: Bounty;
}

export function BountyCard({ bounty }: BountyCardProps) {
  const tierColors = {
    'T1': 'bg-green-500/20 text-green-400 border-green-500/50',
    'T2': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
    'T3': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
  };

  const statusColors = {
    'open': 'bg-[#00FF88]/20 text-[#00FF88]',
    'in-progress': 'bg-blue-500/20 text-blue-400',
    'completed': 'bg-gray-500/20 text-gray-400'
  };

  const timeRemaining = () => {
    const diff = bounty.deadline - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 hover:border-[#00FF88]/50 transition-colors cursor-pointer">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span className={`px-2 py-1 text-xs font-medium rounded border ${tierColors[bounty.tier]}`}>
          {bounty.tier}
        </span>
        <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[bounty.status]}`}>
          {bounty.status}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold mb-2 text-white">
        {bounty.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
        {bounty.description}
      </p>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm mb-4">
        <div className="text-[#00FF88] font-bold">
          {bounty.reward.toLocaleString()} FNDRY
        </div>
        <div className="text-gray-500">
          ⏱ {timeRemaining()} left
        </div>
      </div>

      {/* Skills */}
      <div className="flex flex-wrap gap-1 mb-3">
        {bounty.skills.slice(0, 3).map(skill => (
          <span key={skill} className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
            {skill}
          </span>
        ))}
        {bounty.skills.length > 3 && (
          <span className="px-2 py-0.5 text-xs bg-gray-800 text-gray-300 rounded">
            +{bounty.skills.length - 3}
          </span>
        )}
      </div>

      {/* Submissions */}
      <div className="text-xs text-gray-500">
        {bounty.submissions} submissions
      </div>
    </div>
  );
}