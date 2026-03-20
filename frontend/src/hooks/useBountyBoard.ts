import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Bounty, BountyBoardFilters, BountySortBy } from '../types/bounty';
import { DEFAULT_FILTERS } from '../types/bounty';

const REPO = 'SolFoundry/solfoundry';
const GITHUB_API = 'https://api.github.com';

const TIER_MAP: Record<number, 'T1' | 'T2' | 'T3'> = { 1: 'T1', 2: 'T2', 3: 'T3' };
const STATUS_MAP: Record<string, 'open' | 'in-progress' | 'completed'> = {
  open: 'open',
  in_progress: 'in-progress',
  completed: 'completed',
  paid: 'completed',
};

/** Display-friendly skill names from GitHub labels. */
const SKILL_DISPLAY: Record<string, string> = {
  python: 'Python', typescript: 'TypeScript', react: 'React',
  fastapi: 'FastAPI', solana: 'Solana', rust: 'Rust',
  anchor: 'Anchor', postgresql: 'PostgreSQL', redis: 'Redis',
  websocket: 'WebSocket', devops: 'DevOps', docker: 'Docker',
  frontend: 'Frontend', backend: 'Backend', 'node.js': 'Node.js',
};

const META_LABELS = new Set([
  'bounty', 'tier-1', 'tier-2', 'tier-3',
  'good first issue', 'help wanted', 'bug', 'enhancement',
  'duplicate', 'invalid', 'wontfix', 'question',
]);

/** Transform a backend API bounty (snake_case) into frontend Bounty. */
function mapApiBounty(b: any): Bounty {
  return {
    id: b.id,
    title: b.title,
    description: b.description || '',
    tier: TIER_MAP[b.tier] || 'T2',
    skills: b.required_skills || [],
    rewardAmount: b.reward_amount,
    currency: '$FNDRY',
    deadline: b.deadline || new Date(Date.now() + 14 * 86400000).toISOString(),
    status: STATUS_MAP[b.status] || 'open',
    submissionCount: b.submission_count || 0,
    createdAt: b.created_at,
    projectName: b.created_by || 'SolFoundry',
    githubIssueUrl: b.github_issue_url || undefined,
  };
}

/** Parse reward amount from issue title like "— 500,000 $FNDRY". */
function parseReward(title: string): number {
  const m = title.match(/([\d,]+)\s*\$FNDRY/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
}

/** Parse tier from GitHub labels. */
function parseTier(labels: any[]): 'T1' | 'T2' | 'T3' {
  for (const l of labels) {
    const name = l.name || l;
    if (name === 'tier-3') return 'T3';
    if (name === 'tier-2') return 'T2';
    if (name === 'tier-1') return 'T1';
  }
  return 'T1';
}

/** Extract skill tags from labels. */
function parseSkills(labels: any[]): string[] {
  return labels
    .map((l: any) => (l.name || l) as string)
    .filter(name => !META_LABELS.has(name.toLowerCase()))
    .map(name => SKILL_DISPLAY[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1));
}

/** Clean title — remove emoji prefix and trailing reward. */
function cleanTitle(title: string): string {
  let clean = title.replace(/^[🏭🔧⚡🎨🛡️🚀💰]*\s*Bounty:\s*/u, '').trim();
  clean = clean.replace(/\s*—\s*[\d,]+\s*\$FNDRY\s*$/, '').trim();
  return clean || title;
}

/** Transform a GitHub issue into a frontend Bounty. */
function mapGitHubIssue(issue: any): Bounty {
  const labels = issue.labels || [];
  const isOpen = issue.state === 'open';
  const hasAssignee = !!(issue.assignee || (issue.assignees && issue.assignees.length > 0));

  let status: 'open' | 'in-progress' | 'completed' = 'open';
  if (!isOpen) status = 'completed';
  else if (hasAssignee) status = 'in-progress';

  const createdAt = issue.created_at || new Date().toISOString();
  const deadline = new Date(new Date(createdAt).getTime() + 14 * 86400000).toISOString();

  return {
    id: `gh-${issue.number}`,
    title: cleanTitle(issue.title || ''),
    description: (issue.body || '').slice(0, 500),
    tier: parseTier(labels),
    skills: parseSkills(labels),
    rewardAmount: parseReward(issue.title || ''),
    currency: '$FNDRY',
    deadline,
    status,
    submissionCount: 0,
    createdAt,
    projectName: 'SolFoundry',
    githubIssueUrl: issue.html_url || `https://github.com/${REPO}/issues/${issue.number}`,
  };
}

/** Fetch bounty-labeled issues directly from GitHub API (no auth needed for public repos). */
async function fetchGitHubBounties(): Promise<Bounty[]> {
  const allBounties: Bounty[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${GITHUB_API}/repos/${REPO}/issues?labels=bounty&state=all&per_page=${perPage}&page=${page}&sort=created&direction=desc`;
    const res = await fetch(url);
    if (!res.ok) break;

    const issues = await res.json();
    if (!Array.isArray(issues) || issues.length === 0) break;

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const realIssues = issues.filter((i: any) => !i.pull_request);
    allBounties.push(...realIssues.map(mapGitHubIssue));

    if (issues.length < perPage) break;
    page++;
  }

  return allBounties;
}

export function useBountyBoard() {
  const [allBounties, setAllBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<BountyBoardFilters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<BountySortBy>('newest');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Primary: try backend API first (faster, pre-processed)
        const apiRes = await fetch('/api/bounties?limit=100');
        if (!cancelled && apiRes.ok) {
          const data = await apiRes.json();
          const items = data.items || data;
          if (Array.isArray(items) && items.length > 0) {
            setAllBounties(items.map(mapApiBounty));
            setLoading(false);
            return;
          }
        }
      } catch {
        // Backend unavailable — fall through to GitHub
      }

      try {
        // Fallback: fetch directly from GitHub API
        const bounties = await fetchGitHubBounties();
        if (!cancelled && bounties.length > 0) {
          setAllBounties(bounties);
        }
      } catch {
        // GitHub also failed — show empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const bounties = useMemo(() => {
    let r = [...allBounties];
    if (filters.tier !== 'all') r = r.filter(b => b.tier === filters.tier);
    if (filters.status !== 'all') r = r.filter(b => b.status === filters.status);
    if (filters.skills.length) r = r.filter(b => filters.skills.some(s => b.skills.map(sk => sk.toLowerCase()).includes(s.toLowerCase())));
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      r = r.filter(b => b.title.toLowerCase().includes(q) || b.projectName.toLowerCase().includes(q));
    }
    return r.sort((a, b) =>
      sortBy === 'reward' ? b.rewardAmount - a.rewardAmount
      : sortBy === 'deadline' ? new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [allBounties, filters, sortBy]);

  const setFilter = useCallback(<K extends keyof BountyBoardFilters>(k: K, v: BountyBoardFilters[K]) =>
    setFilters(p => ({ ...p, [k]: v })), []);

  return {
    bounties,
    allBounties,
    filters,
    sortBy,
    loading,
    setFilter,
    resetFilters: useCallback(() => setFilters(DEFAULT_FILTERS), []),
    setSortBy,
  };
}
