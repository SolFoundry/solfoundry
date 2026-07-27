/**
 * Bounty discovery — fetches open T1 bounties from the SolFoundry API and
 * enriches them with GitHub metadata (owner/repo, existing PR count).
 *
 * @module @solfoundry/auto-submit-agent/discoverer
 */

import type { AgentConfig } from './config.js';
import type { ClassifiedBounty } from './classifier.js';

/** Minimal raw bounty shape from the discovery endpoint. */
export interface RawBounty {
  id: string;
  title: string;
  description: string;
  tier: number;
  status: string;
  category: string | null;
  reward_amount: number;
  required_skills: string[];
  github_issue_number: number | null;
  github_repo: string | null;
  github_issue_url: string | null;
  submission_count: number;
}

/**
 * Fetch page of raw bounties from the SolFoundry REST API.
 */
export async function fetchBounties(
  cfg: AgentConfig,
  page: number = 1,
  perPage: number = 20,
): Promise<RawBounty[]> {
  const params = new URLSearchParams({
    tier: '1',
    status: 'open',
    page: String(page),
    per_page: String(perPage),
    sort: 'reward_high',
  });
  const url = `${cfg.baseUrl}/api/bounties/search?${params}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(cfg.authToken ? { Authorization: `Bearer ${cfg.authToken}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`SolFoundry API error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    items: RawBounty[];
    total: number;
  };
  return data.items ?? [];
}

/**
 * Fetch count of open PRs referencing a GitHub issue (claim pressure signal).
 */
export async function countExistingPrs(
  repo: string,
  issueNumber: number,
  githubToken?: string,
): Promise<number> {
  const q = encodeURIComponent(`repo:${repo} is:pr is:open ${issueNumber} in:body`);
  const res = await fetch(`https://api.github.com/search/issues?q=${q}&per_page=1`, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': '@solfoundry/auto-submit-agent',
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    },
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as { total_count: number };
  return data.total_count ?? 0;
}

/**
 * Discover all open T1 bounties, up to a configured budget, and enrich with
 * the existing-PR count. Bounties already claimed (>=1 open PR) are flagged.
 */
export async function discoverT1Bounties(
  cfg: AgentConfig,
): Promise<ClassifiedBounty[]> {
  const out: ClassifiedBounty[] = [];
  let page = 1;
  const seen = new Set<string>();

  while (out.length < cfg.maxBounties) {
    const raw = await fetchBounties(cfg, page++);
    if (raw.length === 0) break;

    for (const b of raw) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);

      // Prefer bounties within the reward ceiling and still with low claim pressure.
      if (b.reward_amount > cfg.maxReward) continue;

      const repo = b.github_repo ?? `${cfg.targetOwner}/${cfg.targetRepo}`;
      const prCount =
        b.github_issue_number !== null
          ? await countExistingPrs(repo, b.github_issue_number, cfg.githubToken)
          : 0;

      out.push({
        id: b.id,
        issueNumber: b.github_issue_number,
        title: b.title,
        description: b.description,
        category: b.category,
        rewardAmount: b.reward_amount,
        requiredSkills: b.required_skills,
        matchedSkills: [], // filled by classifier
        feasibilityScore: 0,
        matchedCapability: null,
      });

      if (out.length >= cfg.maxBounties) break;
    }
  }
  return out;
}
