import { execSync } from 'child_process';
import type { Bounty, AgentResult } from '../types/index.js';

const BOUNTY_LABELS = ['bounty', 'bounty-t1', 'bounty-t2', 'bounty-t3', 'tier-1', 'tier-2', 'tier-3', 'bounty:'];

export class Scanner {
  /** Search repos for bounty-labeled open issues via GitHub API */
  async findBounties(repos: string[]): Promise<AgentResult<Bounty[]>> {
    const start = Date.now();
    const bounties: Bounty[] = [];
    const errors: string[] = [];

    for (const repo of repos) {
      try {
        const query = `repo:${repo} is:issue is:open label:bounty`;
        const output = execSync(
          `gh search issues --kind issue --json number,title,url,body,labels,state,repositoryUrl ${JSON.stringify(query)} --limit 30 2>/dev/null`,
          { timeout: 30000 }
        );
        const issues = JSON.parse(output.toString());

        for (const issue of issues) {
          if (issue.state !== 'OPEN') continue;
          const bounty = this.parse(issue, repo);
          if (bounty) bounties.push(bounty);
        }
      } catch (e: any) {
        if (e.status !== 0) errors.push(`${repo}: ${e.message}`);
      }
    }

    return {
      success: errors.length < repos.length,
      data: bounties,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      duration: Date.now() - start,
    };
  }

  /** Check if an issue already has a PR — if so, skip it */
  async filterEligible(bounties: Bounty[]): Promise<Bounty[]> {
    const eligible: Bounty[] = [];
    for (const b of bounties) {
      try {
        const prs = execSync(
          `gh api repos/${b.repo}/issues/${b.issueNumber}/pull_requests --jq 'length' 2>/dev/null || echo 0`,
          { timeout: 10000 }
        );
        if (parseInt(prs.toString().trim()) > 0) continue;
      } catch { /* no PRs or API error — assume eligible */ }

      // Skip claim-based that are already assigned
      if (b.labels.includes('claim-based') && b.labels.some(l => l.includes('assigned'))) continue;

      eligible.push(b);
    }
    return eligible;
  }

  private parse(issue: any, repo: string): Bounty | null {
    const body = issue.body || '';
    const rewardMatch = body.match(/(?:Reward|reward|bounty)[:\s]*([$\d,\.]+\s*(?:FNDRY|USDC|USD|SOL|ETH)?)/i);
    const tierMatch = body.match(/Tier\s*([123])/i);
    const tierLabel = issue.labels?.find((l: string) => /tier-[123]/.test(l));
    const tier = tierMatch?.[1] || tierLabel?.match(/tier-(\d)/)?.[1] || '1';

    return {
      id: `${repo}:${issue.number}`,
      repo,
      issueNumber: issue.number,
      title: issue.title,
      url: issue.url || `https://github.com/${repo}/issues/${issue.number}`,
      tier: tier as Bounty['tier'],
      reward: rewardMatch?.[1] || 'Unknown',
      labels: issue.labels || [],
      body,
    };
  }
}
