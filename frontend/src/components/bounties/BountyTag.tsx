export type TagType = 'skill' | 'category';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  frontend:        { bg: '#3B82F6', text: '#ffffff', border: '#2563EB' },
  backend:         { bg: '#8B5CF6', text: '#ffffff', border: '#7C3AED' },
  'smart-contract':{ bg: '#F59E0B', text: '#ffffff', border: '#D97706' },
  devops:          { bg: '#6B7280', text: '#ffffff', border: '#4B5563' },
  documentation:   { bg: '#10B981', text: '#ffffff', border: '#059669' },
  docs:            { bg: '#10B981', text: '#ffffff', border: '#059669' },
  security:        { bg: '#EF4444', text: '#ffffff', border: '#DC2626' },
  design:          { bg: '#EC4899', text: '#ffffff', border: '#DB2777' },
  content:         { bg: '#14B8A6', text: '#ffffff', border: '#0D9488' },
};

// GitHub-style label colors for well-known tech stacks
const SKILL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  typescript:  { bg: '#0284c7', text: '#ffffff', border: '#0369a1' },
  javascript:  { bg: '#ca8a04', text: '#ffffff', border: '#a16207' },
  rust:        { bg: '#b45309', text: '#ffffff', border: '#92400e' },
  python:      { bg: '#15803d', text: '#ffffff', border: '#166534' },
  solidity:    { bg: '#6d28d9', text: '#ffffff', border: '#5b21b6' },
  react:       { bg: '#0e7490', text: '#ffffff', border: '#155e75' },
  fastapi:     { bg: '#065f46', text: '#ffffff', border: '#064e3b' },
  anchor:      { bg: '#7c3aed', text: '#ffffff', border: '#6d28d9' },
  solana:      { bg: '#14F195', text: '#0f172a', border: '#10b981' },
  'node.js':   { bg: '#166534', text: '#ffffff', border: '#14532d' },
};

const DEFAULT_SKILL_COLOR = { bg: '#374151', text: '#d1d5db', border: '#4B5563' };

function resolveColors(type: TagType, value: string): { bg: string; text: string; border: string } {
  const key = value.toLowerCase();
  if (type === 'category') {
    return CATEGORY_COLORS[key] ?? DEFAULT_SKILL_COLOR;
  }
  return SKILL_COLORS[key] ?? DEFAULT_SKILL_COLOR;
}

interface BountyTagProps {
  type: TagType;
  value: string;
  label?: string;
  onTagClick?: (type: TagType, value: string) => void;
  className?: string;
}

export function BountyTag({ type, value, label, onTagClick, className = '' }: BountyTagProps) {
  const colors = resolveColors(type, value);
  const displayLabel = label ?? value;
  const clickable = typeof onTagClick === 'function';

  const baseStyle: React.CSSProperties = {
    backgroundColor: colors.bg + '22', // ~13% alpha tint, GitHub-label style
    color: colors.bg,
    borderColor: colors.bg + '55',
  };

  const hoverClass = clickable
    ? 'cursor-pointer hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-1'
    : '';

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => onTagClick(type, value)}
        style={baseStyle}
        className={
          `inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity ${hoverClass} ${className}`
        }
        data-testid={`bounty-tag-${type}-${value}`}
        aria-label={`Filter by ${type}: ${displayLabel}`}
      >
        {displayLabel}
      </button>
    );
  }

  return (
    <span
      style={baseStyle}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
      data-testid={`bounty-tag-${type}-${value}`}
    >
      {displayLabel}
    </span>
  );
}
