import type { TagType } from './BountyTag';
import { BountyTag } from './BountyTag';

interface SkillTagsProps {
  skills: string[];
  maxVisible?: number;
  onTagClick?: (type: TagType, value: string) => void;
}

export function SkillTags({ skills, maxVisible = 3, onTagClick }: SkillTagsProps) {
  const visible = skills.slice(0, maxVisible);
  const overflow = skills.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1" data-testid="skill-tags">
      {visible.map(s => (
        <BountyTag key={s} type="skill" value={s} onTagClick={onTagClick} />
      ))}
      {overflow > 0 && (
        <span className="rounded-full border border-surface-300 bg-surface-200 px-2 py-0.5 text-xs text-gray-500">
          +{overflow}
        </span>
      )}
    </div>
  );
}
