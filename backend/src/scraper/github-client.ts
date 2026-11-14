import { Octokit } from "@octokit/rest";
import { BountyMetadata, BountyTier, TIER_REWARDS } from "./types";

export class GitHubScraper {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async fetchOpenBounties(owner: string, repo: string): Promise<BountyMetadata[]> {
    const { data: issues } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",
      labels: "bounty",
    });

    return issues
      .map((issue) => this.mapIssueToBounty(issue))
      .filter((bounty): bounty is BountyMetadata => bounty !== null);
  }

  public mapIssueToBounty(issue: any): BountyMetadata | null {
    const labels = issue.labels.map((l: any) => (typeof l === "string" ? l : l.name));
    const tierLabel = labels.find((l: string) => Object.values(BountyTier).includes(l as BountyTier));

    if (!tierLabel) return null;

    return {
      githubIssueId: issue.id,
      githubUrl: issue.html_url,
      title: issue.title,
      description: issue.body || "",
      tier: tierLabel as BountyTier,
      rewardAmount: TIER_REWARDS[tierLabel as BountyTier],
    };
  }
}
