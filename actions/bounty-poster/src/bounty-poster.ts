/**
 * Bounty Poster - Handles HTTP communication with SolFoundry API
 */

export interface BountyData {
  title: string;
  description: string;
  tier: number;
  reward_amount: number;
  source_repo: string;
  source_issue: number;
  labels: string[];
  html_url: string;
}

export interface PostResult {
  success: boolean;
  bountyId?: string;
  bountyUrl?: string;
  error?: string;
}

export class BountyPoster {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  /**
   * Post a bounty to SolFoundry API.
   *
   * Maps GitHub issue data to SolFoundry bounty format:
   * - title → title
   * - description → description (with source attribution)
   * - tier → tier (1, 2, or 3)
   * - reward_amount → reward_amount
   * - source_repo → metadata.source_repo
   * - source_issue → metadata.source_issue
   * - labels → tags
   */
  async post(data: BountyData): Promise<PostResult> {
    const endpoint = `${this.baseUrl}/api/bounties`;

    const payload = {
      title: data.title,
      description: this.formatDescription(data),
      tier: data.tier,
      reward_amount: data.reward_amount,
      tags: data.labels,
      metadata: {
        source_repo: data.source_repo,
        source_issue: data.source_issue,
        source_url: data.html_url,
        source_type: 'github_issue',
      },
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Action-Source': 'solfoundry-github-action',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorBody}`,
        };
      }

      const result = await response.json();
      return {
        success: true,
        bountyId: result.id || result.bounty_id,
        bountyUrl: result.url || result.bounty_url,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format the bounty description with source attribution.
   */
  private formatDescription(data: BountyData): string {
    const sourceAttribution = `\n\n---\n*This bounty was automatically created from GitHub issue #${data.source_issue} in [${data.source_repo}](${data.html_url}).*`;
    return data.description + sourceAttribution;
  }

  /**
   * Verify API connectivity and authentication.
   */
  async verify(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
