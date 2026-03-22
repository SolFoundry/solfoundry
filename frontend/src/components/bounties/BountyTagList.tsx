import type { TagType } from './BountyTag';
import { BountyTag } from './BountyTag';
import type { BountyCategory, BountyTier } from '../../types/bounty';

const CATEGORY_LABELS: Record<string, string> = {
  'smart-contract': 'Smart Contract',
  frontend: 'Frontend',
  backend: 'Backend',
  design: 'Design',
  content: 'Content',
  security: 'Security',
  devops: 'DevOps',
  documentation: 'Docs',
};

interface BountyTagListProps {
  skills?: string[];
  category?: BountyCategory | string;
  tier?: BountyTier;
  maxSkills?: number;
  onTagClick?: (type: TagType, value: string) => void;
  showTier?: boolean;
}

export function BountyTagList({
  skills = [],
  category,
  tier,
  maxSkills,
  onTagClick,
  showTier = false,
}: BountyTagListProps) {
  const visibleSkills = maxSkills != null ? skills.slice(0, maxSkills) : skills;
  const overflow = maxSkills != null ? skills.length - maxSkills : 0;

  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="bounty-tag-list">
      {/* Tier badge rendered as a styled tag */}
      {showTier && tier && (
        <TierTag tier={tier} onTagClick={onTagClick} />
      )}

      {/* Category tag */}
      {category && category !== 'all' && (
        <BountyTag
          type="category"
          value={category}
          label={CATEGORY_LABELS[category] ?? category}
          onTagClick={onTagClick}
        />
      )}

      {/* Skill tags */}
      {visibleSkills.map(s => (
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

// Tier-specific tag with fixed color mapping matching TierBadge conventions
const TIER_COLORS: Record<BountyTier, React.CSSProperties> = {
  T1: { backgroundColor: '#14F19522', color: '#14F195', borderColor: '#14F19555' },
  T2: { backgroundColor: '#FFD70022', color: '#FFD700', borderColor: '#FFD70055' },
  T3: { backgroundColor: '#FF6B6B22', color: '#FF6B6B', borderColor: '#FF6B6B55' },
};

function TierTag({ tier, onTagClick }: { tier: BountyTier; onTagClick?: (type: TagType, value: string) => void }) {
  const style = TIER_COLORS[tier];

  if (typeof onTagClick === 'function') {
    return (
      <button
        type="button"
        onClick={() => onTagClick('category', tier)}
        style={style}
        className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold cursor-pointer hover:opacity-80 transition-opacity focus-visible:ring-2"
        data-testid={`bounty-tag-tier-${tier}`}
        aria-label={`Filter by tier: ${tier}`}
      >
        {tier}
      </button>
    );
  }

  return (
    <span
      style={style}
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold"
      data-testid={`bounty-tag-tier-${tier}`}
    >
      {tier}
    </span>
  );
}
