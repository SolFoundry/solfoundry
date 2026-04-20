/**
 * SolFoundry MCP Server — Tool Registrations
 *
 * All MCP tools for interacting with the SolFoundry bounty platform.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type {
  SolFoundryConfig,
  Bounty,
  BountyCreatePayload,
  BountyUpdatePayload,
  BatchConfig,
  BountiesListParams,
} from './types.js';

// ─── API Helpers ──────────────────────────────────────────────

async function apiRequest<T>(
  config: SolFoundryConfig,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (config.authToken) {
    headers['Authorization'] = `Bearer ${config.authToken}`;
  }

  const resp = await fetch(url, { ...options, headers });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${body || resp.statusText}`);
  }

  return resp.json() as Promise<T>;
}

function formatBounty(b: Bounty): string {
  const lines = [
    `## ${b.title}`,
    `- **ID:** ${b.id}`,
    `- **Tier:** ${b.tier} | **Reward:** ${b.reward_amount.toLocaleString()} ${b.reward_token}`,
    `- **Status:** ${b.status}`,
    `- **Category:** ${b.category ?? 'N/A'}`,
    `- **Skills:** ${b.skills.join(', ') || 'N/A'}`,
    `- **Submissions:** ${b.submission_count}`,
    `- **Deadline:** ${b.deadline ?? 'None'}`,
    `- **Created:** ${new Date(b.created_at).toLocaleDateString()}`,
  ];
  if (b.github_issue_url) lines.push(`- **Issue:** ${b.github_issue_url}`);
  if (b.github_repo_url) lines.push(`- **Repo:** ${b.github_repo_url}`);
  lines.push('', b.description.substring(0, 500));
  return lines.join('\n');
}

// ─── Tool Registration ────────────────────────────────────────

export function registerTools(server: McpServer, config: SolFoundryConfig): void {

  // ── List Bounties ──
  server.tool(
    'solfoundry_list_bounties',
    'Browse and filter SolFoundry bounties. Filter by status, tier, reward token, or skill.',
    {
      status: z.enum(['open', 'in_review', 'completed', 'cancelled', 'funded']).optional().describe('Filter by bounty status'),
      tier: z.enum(['T1', 'T2', 'T3']).optional().describe('Filter by bounty tier'),
      reward_token: z.enum(['USDC', 'FNDRY']).optional().describe('Filter by reward token type'),
      skill: z.string().optional().describe('Filter by skill keyword (e.g. "python", "react")'),
      limit: z.number().optional().default(10).describe('Max results to return'),
      offset: z.number().optional().default(0).describe('Pagination offset'),
    },
    async (params) => {
      const queryParts: string[] = [];
      if (params.status) queryParts.push(`status=${params.status}`);
      if (params.tier) queryParts.push(`tier=${params.tier}`);
      if (params.reward_token) queryParts.push(`reward_token=${params.reward_token}`);
      if (params.skill) queryParts.push(`skill=${encodeURIComponent(params.skill)}`);
      queryParts.push(`limit=${params.limit}`);
      queryParts.push(`offset=${params.offset}`);

      const query = queryParts.join('&');
      const data = await apiRequest<any>(config, `/api/bounties?${query}`);
      const items: Bounty[] = Array.isArray(data) ? data : data.items ?? [];
      const total = data.total ?? items.length;

      if (items.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No bounties found matching the filter criteria.' }] };
      }

      const text = `Found ${total} bounties (showing ${items.length}):\n\n${items.map(formatBounty).join('\n\n---\n\n')}`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );

  // ── Get Bounty ──
  server.tool(
    'solfoundry_get_bounty',
    'Get full details of a specific bounty by ID.',
    {
      bounty_id: z.string().describe('The bounty ID to retrieve'),
    },
    async ({ bounty_id }) => {
      const bounty = await apiRequest<Bounty>(config, `/api/bounties/${bounty_id}`);
      return {
        content: [{ type: 'text' as const, text: formatBounty(bounty) }],
      };
    }
  );

  // ── Create Bounty ──
  server.tool(
    'solfoundry_create_bounty',
    'Create a new bounty on SolFoundry. Requires authentication (SOLFOUNDRY_TOKEN).',
    {
      title: z.string().describe('Bounty title'),
      description: z.string().describe('Detailed bounty description and acceptance criteria'),
      reward_amount: z.number().describe('Reward amount in tokens'),
      reward_token: z.enum(['USDC', 'FNDRY']).describe('Token type for reward'),
      tier: z.enum(['T1', 'T2', 'T3']).optional().describe('Bounty tier'),
      deadline: z.string().optional().describe('Deadline in ISO 8601 format'),
      github_repo_url: z.string().optional().describe('Associated GitHub repository URL'),
      github_issue_url: z.string().optional().describe('Associated GitHub issue URL'),
      skills: z.array(z.string()).optional().describe('Required skills (e.g. ["python", "react"])'),
    },
    async (params) => {
      if (!config.authToken) {
        return {
          content: [{ type: 'text' as const, text: 'Error: SOLFOUNDRY_TOKEN environment variable is required for creating bounties.' }],
        };
      }

      const payload: BountyCreatePayload = {
        title: params.title,
        description: params.description,
        reward_amount: params.reward_amount,
        reward_token: params.reward_token,
        ...(params.tier && { tier: params.tier }),
        ...(params.deadline && { deadline: params.deadline }),
        ...(params.github_repo_url && { github_repo_url: params.github_repo_url }),
        ...(params.github_issue_url && { github_issue_url: params.github_issue_url }),
        ...(params.skills && { skills: params.skills }),
      };

      const bounty = await apiRequest<Bounty>(config, '/api/bounties', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        content: [{ type: 'text' as const, text: `✅ Bounty created successfully!\n\n${formatBounty(bounty)}` }],
      };
    }
  );

  // ── Update Bounty ──
  server.tool(
    'solfoundry_update_bounty',
    'Update an existing bounty. Requires authentication.',
    {
      bounty_id: z.string().describe('The bounty ID to update'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
      status: z.enum(['open', 'in_review', 'completed', 'cancelled', 'funded']).optional().describe('New status'),
      reward_amount: z.number().optional().describe('New reward amount'),
      deadline: z.string().optional().describe('New deadline (ISO 8601) or null to remove'),
      skills: z.array(z.string()).optional().describe('Updated skills list'),
    },
    async ({ bounty_id, ...updates }) => {
      if (!config.authToken) {
        return {
          content: [{ type: 'text' as const, text: 'Error: SOLFOUNDRY_TOKEN required.' }],
        };
      }

      const payload: BountyUpdatePayload = {};
      if (updates.title) payload.title = updates.title;
      if (updates.description) payload.description = updates.description;
      if (updates.status) payload.status = updates.status;
      if (updates.reward_amount !== undefined) payload.reward_amount = updates.reward_amount;
      if (updates.deadline !== undefined) payload.deadline = updates.deadline;
      if (updates.skills) payload.skills = updates.skills;

      const bounty = await apiRequest<Bounty>(config, `/api/bounties/${bounty_id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      return {
        content: [{ type: 'text' as const, text: `✅ Bounty updated!\n\n${formatBounty(bounty)}` }],
      };
    }
  );

  // ── Delete / Cancel Bounty ──
  server.tool(
    'solfoundry_delete_bounty',
    'Cancel a bounty (sets status to cancelled). Requires authentication.',
    {
      bounty_id: z.string().describe('The bounty ID to cancel'),
    },
    async ({ bounty_id }) => {
      if (!config.authToken) {
        return {
          content: [{ type: 'text' as const, text: 'Error: SOLFOUNDRY_TOKEN required.' }],
        };
      }

      await apiRequest(config, `/api/bounties/${bounty_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });

      return {
        content: [{ type: 'text' as const, text: `✅ Bounty ${bounty_id} cancelled.` }],
      };
    }
  );

  // ── Batch Create ──
  server.tool(
    'solfoundry_batch_create',
    'Create multiple bounties from a JSON configuration. Reads a JSON string with a "bounties" array.',
    {
      config_json: z.string().describe('JSON string with structure: { "bounties": [{ title, description, reward_amount, reward_token, ... }] }'),
    },
    async ({ config_json }) => {
      if (!config.authToken) {
        return {
          content: [{ type: 'text' as const, text: 'Error: SOLFOUNDRY_TOKEN required for batch creation.' }],
        };
      }

      let batch: BatchConfig;
      try {
        batch = JSON.parse(config_json);
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'Error: Invalid JSON in config_json.' }],
        };
      }

      if (!batch.bounties || !Array.isArray(batch.bounties) || batch.bounties.length === 0) {
        return {
          content: [{ type: 'text' as const, text: 'Error: config must have a non-empty "bounties" array.' }],
        };
      }

      const results: string[] = [];
      let created = 0;
      let failed = 0;

      for (let i = 0; i < batch.bounties.length; i++) {
        const b = batch.bounties[i];
        try {
          const bounty = await apiRequest<Bounty>(config, '/api/bounties', {
            method: 'POST',
            body: JSON.stringify(b),
          });
          results.push(`  ✅ [${i + 1}] "${b.title}" → ID: ${bounty.id}`);
          created++;
        } catch (err: any) {
          results.push(`  ❌ [${i + 1}] "${b.title}" → ${err.message}`);
          failed++;
        }
      }

      const summary = `Batch complete: ${created} created, ${failed} failed out of ${batch.bounties.length} total.\n\n${results.join('\n')}`;
      return { content: [{ type: 'text' as const, text: summary }] };
    }
  );

  // ── List Submissions ──
  server.tool(
    'solfoundry_list_submissions',
    'View all submissions for a specific bounty.',
    {
      bounty_id: z.string().describe('The bounty ID'),
    },
    async ({ bounty_id }) => {
      const data = await apiRequest<any>(config, `/api/bounties/${bounty_id}/submissions`);
      const items = Array.isArray(data) ? data : data.items ?? [];

      if (items.length === 0) {
        return { content: [{ type: 'text' as const, text: `No submissions found for bounty ${bounty_id}.` }] };
      }

      const lines = items.map((s: any) =>
        `### Submission ${s.id}\n- **Contributor:** ${s.contributor_username ?? s.contributor_id}\n- **PR:** ${s.pr_url ?? 'N/A'}\n- **Status:** ${s.status}\n- **Score:** ${s.review_score ?? 'N/A'}\n- **Submitted:** ${new Date(s.created_at).toLocaleDateString()}`
      );

      return {
        content: [{ type: 'text' as const, text: `Submissions for bounty ${bounty_id} (${items.length}):\n\n${lines.join('\n\n')}` }],
      };
    }
  );

  // ── Submit PR ──
  server.tool(
    'solfoundry_submit',
    'Submit a pull request for a bounty.',
    {
      bounty_id: z.string().describe('The bounty ID to submit for'),
      pr_url: z.string().describe('URL of the GitHub pull request'),
      description: z.string().optional().describe('Description of your submission'),
      repo_url: z.string().optional().describe('URL of your forked repository'),
    },
    async (params) => {
      if (!config.authToken) {
        return {
          content: [{ type: 'text' as const, text: 'Error: SOLFOUNDRY_TOKEN required for submissions.' }],
        };
      }

      const payload: Record<string, string> = {
        pr_url: params.pr_url,
      };
      if (params.description) payload.description = params.description;
      if (params.repo_url) payload.repo_url = params.repo_url;

      const result = await apiRequest<any>(config, `/api/bounties/${params.bounty_id}/submissions`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return {
        content: [{ type: 'text' as const, text: `✅ Submission recorded!\n\nSubmission ID: ${result.id}\nBounty: ${params.bounty_id}\nPR: ${params.pr_url}\nStatus: ${result.status ?? 'pending'}` }],
      };
    }
  );

  // ── Leaderboard ──
  server.tool(
    'solfoundry_leaderboard',
    'View the contributor leaderboard.',
    {
      period: z.enum(['day', 'week', 'month', 'all']).optional().default('all').describe('Time period filter'),
    },
    async ({ period }) => {
      const query = period && period !== 'all' ? `?period=${period}` : '';
      const data = await apiRequest<any>(config, `/api/leaderboard${query}`);
      const entries = Array.isArray(data) ? data : data.items ?? [];

      if (entries.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No leaderboard data available.' }] };
      }

      const lines = entries.slice(0, 20).map((e: any, i: number) =>
        `${i + 1}. **${e.username}** — ${e.total_earned?.toLocaleString() ?? 0} earned, ${e.bounties_completed ?? 0} bounties`
      );

      return {
        content: [{ type: 'text' as const, text: `🏆 SolFoundry Leaderboard (${period}):\n\n${lines.join('\n')}` }],
      };
    }
  );

  // ── Platform Stats ──
  server.tool(
    'solfoundry_stats',
    'View SolFoundry platform statistics.',
    {},
    async () => {
      const stats = await apiRequest<any>(config, '/api/stats');

      const text = [
        '📊 SolFoundry Platform Statistics:',
        `- Open Bounties: ${stats.open_bounties ?? stats.active_bounties ?? 'N/A'}`,
        `- Total Bounties: ${stats.total_bounties ?? 'N/A'}`,
        `- Total Paid (USDC): $${(stats.total_paid_usdc ?? stats.total_rewards_paid ?? 0).toLocaleString()}`,
        `- Total Contributors: ${stats.total_contributors ?? stats.contributors ?? 'N/A'}`,
      ].join('\n');

      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
