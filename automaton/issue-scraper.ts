import { Octokit } from "@octokit/rest";
import axios from "axios";

/**
 * GitHub Issue Scraper for SolFoundry
 * 
 * Automatically detects labeled issues from GitHub repositories and
 * posts them as bounties to the SolFoundry platform.
 */

interface RepoConfig {
  owner: string;
  repo: string;
  bountyLabel: string;
}

interface BountyPayload {
  title: string;
  description: string;
  githubUrl: string;
  rewardTier: "T1" | "T2" | "T3";
  domain: string;
  metadata: Record<string, any>;
}

export class IssueScraperService {
  private octokit: Octokit;
  private apiUrl: string;
  private apiKey: string;

  constructor(githubToken: string, apiUrl: string, apiKey: string) {
    this.octokit = new Octokit({ auth: githubToken });
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  /**
   * Scrape issues from a repository based on labels
   */
  async scrapeRepo(config: RepoConfig): Promise<number> {
    console.log(`Scraping ${config.owner}/${config.repo} for label "${config.bountyLabel}"...`);
    
    try {
      const { data: issues } = await this.octokit.issues.listForRepo({
        owner: config.owner,
        repo: config.repo,
        labels: config.bountyLabel,
        state: "open",
      });

      let count = 0;
      for (const issue of issues) {
        // Skip pull requests
        if (issue.pull_request) continue;

        const success = await this.postToFoundry({
          title: issue.title,
          description: issue.body || "No description provided.",
          githubUrl: issue.html_url,
          rewardTier: this.determineTier(issue),
          domain: this.determineDomain(issue),
          metadata: {
            issueNumber: issue.number,
            repository: `${config.owner}/${config.repo}`,
            labels: issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name)),
            createdAt: issue.created_at,
          }
        });

        if (success) count++;
      }

      return count;
    } catch (error) {
      console.error(`Failed to scrape ${config.owner}/${config.repo}:`, error);
      return 0;
    }
  }

  /**
   * Post scraped issue as a bounty to SolFoundry
   */
  private async postToFoundry(payload: BountyPayload): Promise<boolean> {
    try {
      // Check if bounty already exists (idempotency)
      const { data: existing } = await axios.get(`${this.apiUrl}/bounties`, {
        params: { githubUrl: payload.githubUrl },
        headers: { "X-API-Key": this.apiKey }
      });

      if (existing && existing.length > 0) {
        console.log(`Bounty already exists for ${payload.githubUrl}, skipping.`);
        return false;
      }

      await axios.post(`${this.apiUrl}/bounties`, payload, {
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": this.apiKey 
        }
      });

      console.log(`Successfully posted bounty: ${payload.title}`);
      return true;
    } catch (error) {
      console.error(`Failed to post bounty to SolFoundry:`, error);
      return false;
    }
  }

  /**
   * Simple logic to determine reward tier based on labels or body content
   */
  private determineTier(issue: any): "T1" | "T2" | "T3" {
    const body = (issue.body || "").toLowerCase();
    const labels = issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name).toLowerCase());

    if (labels.includes("tier-3") || body.includes("priority: critical")) return "T3";
    if (labels.includes("tier-2") || body.includes("priority: high")) return "T2";
    return "T1";
  }

  /**
   * Determine task domain based on labels
   */
  private determineDomain(issue: any): string {
    const labels = issue.labels.map((l: any) => (typeof l === 'string' ? l : l.name).toLowerCase());
    
    if (labels.includes("frontend") || labels.includes("ui")) return "Frontend";
    if (labels.includes("backend") || labels.includes("api")) return "Backend";
    if (labels.includes("solana") || labels.includes("smart-contract")) return "Blockchain";
    if (labels.includes("ai") || labels.includes("llm")) return "Agent";
    
    return "General";
  }
}
