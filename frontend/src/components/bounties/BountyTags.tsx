import { useCallback, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom';
import type { BountyCategory, BountyTier } from '../../types/bounty';
import { CATEGORY_OPTIONS, normalizeBountyCategory } from '../../types/bounty';
import { bountyCategoryPillClass, bountySkillPillClass, bountyTierPillClass } from './bountyLabelTheme';

const BOARD_PATH = '/bounties';

function categoryLabel(cat: BountyCategory): string {
  return CATEGORY_OPTIONS.find(o => o.value === cat)?.label ?? cat;
}

function toggleSingleSearchParam(
  current: URLSearchParams,
  key: 'category' | 'tier',
  value: string,
): string {
  const next = new URLSearchParams(current);
  if (next.get(key) === value) next.delete(key);
  else next.set(key, value);
  next.delete('page');
  return next.toString();
}

function toggleSkillSearchParam(current: URLSearchParams, skill: string): string {
  const next = new URLSearchParams(current);
  const existing = (next.get('skills') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const lower = skill.toLowerCase();
  const idx = existing.findIndex(s => s.toLowerCase() === lower);
  const merged = idx >= 0 ? existing.filter((_, i) => i !== idx) : [...existing, skill];
  if (merged.length) next.set('skills', merged.join(','));
  else next.delete('skills');
  next.delete('page');
  return next.toString();
}

export interface BountyTagsProps {
  tier: BountyTier;
  skills: string[];
  /** Raw or normalized category from API */
  category?: string | null;
  /** When true, tag clicks navigate to the bounty board with URL filters (toggle behavior). */
  interactive?: boolean;
  /** Omit tier pill when the parent already shows a tier badge. */
  showTier?: boolean;
  maxSkills?: number;
  className?: string;
  'data-testid'?: string;
}

type InnerProps = BountyTagsProps & {
  navigate: NavigateFunction | null;
  searchParams: URLSearchParams | null;
};

function BountyTagsInner({
  tier,
  skills,
  category: categoryRaw,
  interactive = false,
  showTier = true,
  maxSkills,
  className = '',
  'data-testid': testIdPrefix,
  navigate,
  searchParams,
}: InnerProps) {
  const category = normalizeBountyCategory(categoryRaw);

  const applySearch = useCallback(
    (query: string) => {
      if (!navigate) return;
      navigate({ pathname: BOARD_PATH, search: query }, { replace: false });
    },
    [navigate],
  );

  const onCategoryClick = useCallback(() => {
    if (!interactive || !category || !searchParams) return;
    applySearch(toggleSingleSearchParam(searchParams, 'category', category));
  }, [applySearch, category, interactive, searchParams]);

  const onTierClick = useCallback(() => {
    if (!interactive || !searchParams) return;
    applySearch(toggleSingleSearchParam(searchParams, 'tier', tier));
  }, [applySearch, interactive, searchParams, tier]);

  const onSkillClick = useCallback(
    (skill: string) => {
      if (!interactive || !searchParams) return;
      applySearch(toggleSkillSearchParam(searchParams, skill));
    },
    [applySearch, interactive, searchParams],
  );

  const blockParentActivation = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const visibleSkills = maxSkills !== undefined ? skills.slice(0, maxSkills) : skills;
  const overflow = maxSkills !== undefined ? Math.max(0, skills.length - maxSkills) : 0;

  const wrapInteractive = (node: ReactNode, handler: () => void, ariaLabel: string) => {
    if (!interactive || !navigate || !searchParams) return node;
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={e => {
          blockParentActivation(e);
          handler();
        }}
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          blockParentActivation(e);
          handler();
        }}
        className="max-w-full inline-flex cursor-pointer text-left rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solana-purple/50"
        aria-label={ariaLabel}
      >
        {node}
      </span>
    );
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}
      data-testid={testIdPrefix ? `${testIdPrefix}-bounty-tags` : 'bounty-tags'}
    >
      {showTier &&
        wrapInteractive(
          <span className={bountyTierPillClass(tier)} data-testid={testIdPrefix ? `${testIdPrefix}-tier-tag` : 'bounty-tier-tag'}>
            {tier}
          </span>,
          onTierClick,
          `Filter bounties by tier ${tier}`,
        )}

      {category &&
        wrapInteractive(
          <span
            className={bountyCategoryPillClass(category)}
            data-testid={testIdPrefix ? `${testIdPrefix}-category-tag` : 'bounty-category-tag'}
          >
            {categoryLabel(category)}
          </span>,
          onCategoryClick,
          `Filter bounties by category: ${categoryLabel(category)}`,
        )}

      {visibleSkills.map(skill => (
        <span key={skill} className="max-w-full min-w-0">
          {wrapInteractive(
            <span className={`${bountySkillPillClass(skill)} truncate`} data-testid={`bounty-skill-tag-${skill}`}>
              {skill}
            </span>,
            () => onSkillClick(skill),
            `Filter bounties by skill: ${skill}`,
          )}
        </span>
      ))}

      {overflow > 0 && (
        <span className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-surface-400 dark:text-gray-400">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

function BountyTagsInteractive(props: BountyTagsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  return <BountyTagsInner {...props} navigate={navigate} searchParams={searchParams} />;
}

/**
 * Category, tier, and tech-stack pills in GitHub-label colors.
 * With `interactive`, clicks navigate to `/bounties` and toggle URL query filters.
 */
export function BountyTags(props: BountyTagsProps) {
  if (props.interactive) return <BountyTagsInteractive {...props} />;
  return <BountyTagsInner {...props} navigate={null} searchParams={null} />;
}
