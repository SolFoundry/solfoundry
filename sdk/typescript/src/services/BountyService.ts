/**
 * SolFoundry TypeScript SDK - Bounty Service
 * High-level helpers for bounty operations
 */

import type {
  BountyResponse,
  BountyListResponse,
  SubmissionResponse,
  BountyFilters,
  BountyTier,
  BountyStatus,
} from "../types/index.js";
import { SolFoundryClient } from "../client/SolFoundryClient.js";

export class BountyService {
  constructor(private client: SolFoundryClient) {}

  /**
   * Find open bounties matching a skill set, sorted by reward descending
   */
  async findBountiesBySkills(
    skills: string[],
    tier?: BountyTier
  ): Promise<BountyResponse[]> {
    const filters: BountyFilters = {
      status: BountyStatus.OPEN,
      tier,
      skills,
      limit: 50,
    };
    const result = await this.client.listBounties(filters);
    return result.items;
  }

  /**
   * Get the highest-reward open bounties across all tiers
   */
  async getTopBounties(limit = 10): Promise<BountyResponse[]> {
    const result = await this.client.listBounties({
      status: BountyStatus.OPEN,
      limit,
    });
    return result.items.sort((a, b) => b.reward - a.reward);
  }

  /**
   * Get my submissions across all bounties
   */
  async getMySubmissions(
    githubUsername: string
  ): Promise<Map<string, SubmissionResponse[]>> {
    const result = await this.client.listBounties({ limit: 100 });
    const submissionMap = new Map<string, SubmissionResponse[]>();

    await Promise.allSettled(
      result.items.map(async (bounty) => {
        const subs = await this.client.getSubmissions(bounty.id);
        const mine = subs.filter((s) => s.submitted_by === githubUsername);
        if (mine.length > 0) {
          submissionMap.set(bounty.id, mine);
        }
      })
    );

    return submissionMap;
  }

  /**
   * Submit a PR to a bounty with error handling
   */
  async submitPR(
    bountyId: string,
    prUrl: string,
    submittedBy: string,
    notes?: string
  ): Promise<SubmissionResponse> {
    return this.client.submitSolution(bountyId, {
      pr_url: prUrl,
      submitted_by: submittedBy,
      notes,
    });
  }
}
