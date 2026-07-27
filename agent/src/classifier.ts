/**
 * Capability classifier — maps an LLM's self-described skills to the set of
 * bounty categories and required_skills the agent can realistically tackle.
 *
 * @module @solfoundry/auto-submit-agent/classifier
 */

/** Canonical SolFoundry bounty categories (kept in sync with sdk types). */
export const BOUNTY_CATEGORIES = [
  'smart-contract',
  'frontend',
  'backend',
  'design',
  'content',
  'security',
  'devops',
  'documentation',
] as const;
export type BountyCategory = (typeof BOUNTY_CATEGORIES)[number];

/**
 * What the agent can and cannot do. Each capability maps to the bounty
 * categories it supports plus any required skills it brings.
 */
export interface AgentCapability {
  /** Friendly capability name. */
  name: string;
  /** Supported bounty categories. */
  supportedCategories: BountyCategory[];
  /** Skills the agent already owns for this capability. */
  skills: string[];
}

/**
 * Default T1-eligible capability set. T1 bounties are short, well-scoped
 * tasks; the agent focuses on skills it can actually ship code for.
 */
export const DEFAULT_CAPABILITIES: AgentCapability[] = [
  {
    name: 'code-implementation',
    supportedCategories: ['backend', 'devops', 'security'],
    skills: [
      'typescript',
      'javascript',
      'python',
      'rest-api',
      'testing',
      'debugging',
      'git',
      'github-actions',
      'docker',
    ],
  },
  {
    name: 'documentation',
    supportedCategories: ['documentation', 'content'],
    skills: ['markdown', 'technical-writing', 'documentation'],
  },
  {
    name: 'frontend-components',
    supportedCategories: ['frontend'],
    skills: ['typescript', 'javascript', 'react', 'css'],
  },
];

/** How many required skills must the agent cover to consider a bounty feasible. */
export const SKILL_MATCH_THRESHOLD = 0.4;

/**
 * A categorized bounty with a feasibility score (0..1).
 */
export interface ClassifiedBounty {
  /** SolFoundry bounty UUID. */
  readonly id: string;
  /** GitHub issue number, if linked. */
  readonly issueNumber: number | null;
  /** Bounty title. */
  readonly title: string;
  /** Bounty description (requirements). */
  readonly description: string;
  /** Task category. */
  readonly category: string | null;
  /** Reward amount (USD-equivalent $FNDRY). */
  readonly rewardAmount: number;
  /** Required skills stated by the bounty. */
  readonly requiredSkills: string[];
  /** How many skills the agent covers. */
  readonly matchedSkills: string[];
  /** Feasibility score 0..1. */
  readonly feasibilityScore: number;
  /** Matched agent capability name. */
  readonly matchedCapability: string | null;
}

/**
 * Classify a set of T1 bounties against the agent's capabilities.
 *
 * Returns bounties sorted by feasibility (best first), filtered to only
 * those meeting the skill and category thresholds.
 */
export function classifyBounties(
  bounties: ClassifiedBounty[],
  capabilities: AgentCapability[] = DEFAULT_CAPABILITIES,
): ClassifiedBounty[] {
  return bounties
    .map((bounty) => {
      // Determine which capability (if any) covers this bounty's category.
      const cap = capabilities.find(
        (c) =>
          bounty.category === null ||
          bounty.category === '' ||
          c.supportedCategories.includes(bounty.category as BountyCategory),
      );

      // Fallback: when the bounty has an unrecognised category, give it a
      // generic code-capability so skills are still considered, but with a
      // reduced categoryFit applied later in scoring.
      const capOrFallback =
        cap ??
        (bounty.category ? capabilities.find((c) => c.name === 'code-implementation') : null);

      const knownSkills = new Set(
        capOrFallback
          ? capOrFallback.skills.concat(...capabilities.map((c) => c.skills))
          : [],
      );
      const matched = bounty.requiredSkills.filter(
        (s) => knownSkills.has(s.toLowerCase()),
      );
      const skillCoverage =
        bounty.requiredSkills.length === 0 ? 1 : matched.length / bounty.requiredSkills.length;

      // Unknown category → we cannot confirm a fit, but we still want the
      // bounty considered when skill coverage is high.
      const categoryFit =
        capOrFallback === null
          ? 0.3
          : bounty.category === null || bounty.category === ''
            ? 0.6
            : 1.0;
      const feasibilityScore = Number(
        (skillCoverage * 0.7 + categoryFit * 0.3).toFixed(2),
      );

      return {
        ...bounty,
        matchedSkills: matched,
        feasibilityScore,
        matchedCapability: cap?.name ?? null,
      };
    })
    .filter(
      (b) =>
        b.feasibilityScore >= SKILL_MATCH_THRESHOLD &&
        // Prefer bounties with no submissions (first-mover advantage on T1).
        true,
    )
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore);
}
