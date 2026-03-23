import React from 'react';
import { BountyTag } from '../common/BountyTag';

export function SkillTags({ skills, maxVisible = 3, onTagClick }: { skills: string[]; maxVisible?: number; onTagClick?: (tag: string) => void }) {
  const visible = skills.slice(0, maxVisible);
  const overflow = skills.length - maxVisible;
  
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="skill-tags">
      {visible.map(skill => (
        <BountyTag 
          key={skill} 
          label={skill} 
          onClick={onTagClick} 
        />
      ))}
      {overflow > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-200 text-gray-500 border border-surface-300">
          +{overflow}
        </span>
      )}
    </div>
  );
}
