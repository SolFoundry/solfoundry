import React, { useState } from 'react';
import type { BadgeType } from '../../types/gamification';
import { BADGE_DEFINITIONS } from '../../types/gamification';

interface BadgeDisplayProps {
  badges: BadgeType[];
  size?: 'sm' | 'md';
  maxVisible?: number;
}

export function BadgeDisplay({ badges, size = 'sm', maxVisible }: BadgeDisplayProps) {
  const [showAll, setShowAll] = useState(false);
  const visible = maxVisible && !showAll ? badges.slice(0, maxVisible) : badges;
  const hidden = maxVisible && !showAll ? badges.slice(maxVisible) : [];
  if (badges.length === 0) return null;
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-6 h-6';
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {visible.map((badgeType) => {
        const def = BADGE_DEFINITIONS[badgeType];
        if (!def) return null;
        return (
          <div key={badgeType} className="relative group cursor-default" title={`${def.label}: ${def.description}`}>
            <span className={`${iconSize} flex items-center justify-center text-sm`}>{def.icon}</span>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 pointer-events-none">
              <div className="bg-forge-800 border border-border rounded-lg px-2 py-1.5 whitespace-nowrap shadow-xl">
                <div className="text-xs font-semibold text-text-primary">{def.label}</div>
                <div className="text-[10px] text-text-muted mt-0.5">{def.description}</div>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-forge-800" />
            </div>
          </div>
        );
      })}
      {hidden.length > 0 && (
        <button onClick={() => setShowAll(!showAll)} className="text-[10px] text-text-muted hover:text-text-secondary transition-colors ml-0.5">
          +{hidden.length}
        </button>
      )}
    </div>
  );
}