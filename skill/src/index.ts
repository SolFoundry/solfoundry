#!/usr/bin/env node
/**
 * SolFoundry Claude Code MCP Skill
 *
 * A Model Context Protocol server that provides tools for managing
 * SolFoundry bounties directly from the Claude CLI.
 *
 * Tools:
 *   list_bounties          List bounties with optional filters
 *   get_bounty             Get full details of a specific bounty
 *   create_bounty          Create a new bounty
 *   update_bounty          Update an existing bounty
 *   delete_bounty          Delete a draft bounty
 *   batch_create_bounties  Create multiple bounties from a JSON config
 *   submit_solution        Submit a solution (PR) to a bounty
 *   get_contributor        Get contributor profile and stats
 *   list_contributors      List top contributors
 *
 * Environment variables:
 *   SOLFOUNDRY_BASE_URL    API base URL (default: https://api.solfoundry.io)
 *   SOLFOUNDRY_TOKEN       JWT auth token for authenticated requests
 *   SOLFOUNDRY_BATCH_DIR   Directory for batch config files (default: ./batch)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Solana wallet address (base58, 32-44 chars). */
const WalletAddress = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

/** Supported bounty statuses. */
const BountyStatusEnum = z.enum([
  'draft', 'open', 'in_progress', 'under_review', 'completed', 'paid', 'cancelled',
]);

/** Supported bounty tiers. */
const BountyTierEnum = z.number().int().min(1).max(3);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const ListBountiesSchema = z.object({
  status: BountyStatusEnum.optional().default('open'),
  tier: BountyTierEnum.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  skip: z.number().int().min(0).optional().default(0),
});

const GetBountySchema = z.object({
  bounty_id: z.string().uuid(),
});

const CreateBountySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  reward_amount: z.number().positive(),
  tier: BountyTierEnum.optional().default(1),
  deadline: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  github_issue_url: z.string().url().optional(),
});

const UpdateBountySchema = z.object({
  bounty_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  reward_amount: z.number().positive().optional(),
  status: BountyStatusEnum.optional(),
  deadline: z.string().datetime().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

const DeleteBountySchema = z.object({
  bounty_id: z.string().uuid(),
});

const BatchCreateBountiesSchema = z.object({
  bounties: z.array(z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    reward_amount: z.number().positive(),
    tier: BountyTierEnum.optional().default(1),
    deadline: z.string().datetime().optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    github_issue_url: z.string().url().optional(),
  })).min(1).max(50),
  publish: z.boolean().optional().default(false),
});

const SubmitSolutionSchema = z.object({
  bounty_id: z.string().uuid(),
  pr_url: z.string().url(),
  contributor_wallet: WalletAddress.optional(),
  notes: z.string().max(1000).optional(),
});

const GetContributorSchema = z.object({
  username: z.string().min(1).max(100),
});

const ListContributorsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  skip: z.number().int().min(0).optional().default(0),
});

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = [
  {
    name: 'list_bounties',
    description: 'List bounties on the SolFoundry marketplace with optional filtering by status, tier, and pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'open', 'in_progress', 'under_review', 'completed', 'paid', 'cancelled'], description: 'Filter by bounty status (default: open)' },
        tier: { type: 'number', description: 'Filter by tier (1, 2, or 3)' },
        limit: { type: 'number', description: 'Max results (1-100, default: 20)' },
        skip: { type: 'number', description: 'Pagination offset (default: 0)' },
      },
    },
  },
  {
    name: 'get_bounty',
    description: 'Get full details of a specific bounty by its UUID, including all submissions, claim status, and payout info.',
    inputSchema: {
      type: 'object',
      properties: {
        bounty_id: { type: 'string', description: 'UUID of the bounty' },
      },
      required: ['bounty_id'],
    },
  },
  {
    name: 'create_bounty',
    description: 'Create a new bounty on the SolFoundry marketplace. Requires authentication via SOLFOUNDRY_TOKEN.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Bounty title (max 200 chars)' },
        description: { type: 'string', description: 'Detailed description (max 5000 chars)' },
        reward_amount: { type: 'number', description: 'Reward amount in $FNDRY tokens' },
        tier: { type: 'number', description: 'Bounty tier (1, 2, or 3, default: 1)' },
        deadline: { type: 'string', description: 'ISO 8601 deadline datetime' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags (max 10)' },
        github_issue_url: { type: 'string', description: 'Associated GitHub issue URL' },
      },
      required: ['title', 'description', 'reward_amount'],
    },
  },
  {
    name: 'update_bounty',
    description: 'Update an existing bounty. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        bounty_id: { type: 'string', description: 'UUID of the bounty to update' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        reward_amount: { type: 'number', description: 'New reward amount' },
        status: { type: 'string', enum: ['draft', 'open', 'in_progress', 'under_review', 'completed', 'paid', 'cancelled'], description: 'New status' },
        deadline: { type: 'string', description: 'New ISO 8601 deadline' },
        tags: { type: 'array', items: { type: 'string' }, description: 'New tags' },
      },
      required: ['bounty_id'],
    },
  },
  {
    name: 'delete_bounty',
    description: 'Delete a draft or cancelled bounty. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        bounty_id: { type: 'string', description: 'UUID of the bounty to delete' },
      },
      required: ['bounty_id'],
    },
  },
  {
    name: 'batch_create_bounties',
    description: 'Create multiple bounties at once from a JSON array. Requires authentication. Optionally publish them immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        bounties: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Bounty title' },
              description: { type: 'string', description: 'Bounty description' },
              reward_amount: { type: 'number', description: 'Reward in $FNDRY' },
              tier: { type: 'number', description: 'Tier (1, 2, or 3)' },
              deadline: { type: 'string', description: 'ISO 8601 deadline' },
              tags: { type: 'array', items: { type: 'string' } },
              github_issue_url: { type: 'string', description: 'GitHub issue URL' },
            },
            required: ['title', 'description', 'reward_amount'],
          },
          description: 'Array of bounties to create (max 50)',
        },
        publish: { type: 'boolean', description: 'Publish all bounties immediately (default: false, creates as drafts)' },
      },
      required: ['bounties'],
    },
  },
  {
    name: 'submit_solution',
    description: 'Submit a solution (PR) to an existing bounty. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        bounty_id: { type: 'string', description: 'UUID of the bounty' },
        pr_url: { type: 'string', description: 'GitHub PR URL' },
        contributor_wallet: { type: 'string', description: 'Solana wallet for payout (base58)' },
        notes: { type: 'string', description: 'Optional submission notes (max 1000 chars)' },
      },
      required: ['bounty_id', 'pr_url'],
    },
  },
  {
    name: 'get_contributor',
    description: 'Get a contributor profile and their bounty statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', description: 'GitHub username or contributor ID' },
      },
      required: ['username'],
    },
  },
  {
    name: 'list_contributors',
    description: 'List top contributors on the SolFoundry platform.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (1-100, default: 20)' },
        skip: { type: 'number', description: 'Pagination offset' },
      },
    },
  },
];

// ---------------------------------------------------------------------------
// HTTP client (lightweight, no external SDK dependency needed)
// ---------------------------------------------------------------------------

interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

class SolFoundryApi {
  private baseUrl: string;
  private authToken: string | undefined;

  constructor() {
    this.baseUrl = process.env.SOLFOUNDRY_BASE_URL || 'https://api.solfoundry.io';
    this.authToken = process.env.SOLFOUNDRY_TOKEN || undefined;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | undefined>,
  ): Promise<ApiResponse<T>> {
    let url = `${this.baseUrl}${path}`;

    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data: data as T,
          error: (data as { detail?: string })?.detail || `HTTP ${response.status}`,
        };
      }

      return { ok: true, status: response.status, data: data as T };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, data: null as T, error: `Network error: ${message}` };
    }
  }

  async listBounties(params?: {
    status?: string;
    tier?: number;
    limit?: number;
    skip?: number;
  }) {
    return this.request<{ bounties: unknown[]; total: number }>('GET', '/api/bounties', undefined, {
      status: params?.status,
      tier: params?.tier,
      limit: params?.limit,
      skip: params?.skip,
    });
  }

  async getBounty(bountyId: string) {
    return this.request<unknown>('GET', `/api/bounties/${bountyId}`);
  }

  async createBounty(data: {
    title: string;
    description: string;
    reward_amount: number;
    tier?: number;
    deadline?: string;
    tags?: string[];
    github_issue_url?: string;
  }) {
    return this.request<unknown>('POST', '/api/bounties', data);
  }

  async updateBounty(bountyId: string, data: Record<string, unknown>) {
    return this.request<unknown>('PATCH', `/api/bounties/${bountyId}`, data);
  }

  async deleteBounty(bountyId: string) {
    return this.request<{ deleted: boolean }>('DELETE', `/api/bounties/${bountyId}`);
  }

  async submitSolution(bountyId: string, data: {
    pr_url: string;
    contributor_wallet?: string;
    notes?: string;
  }) {
    return this.request<unknown>('POST', `/api/bounties/${bountyId}/submissions`, data);
  }

  async getContributor(username: string) {
    return this.request<unknown>('GET', `/api/contributors/${username}`);
  }

  async listContributors(params?: { limit?: number; skip?: number }) {
    return this.request<{ contributors: unknown[]; total: number }>(
      'GET', '/api/contributors', undefined, params,
    );
  }
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

class SolFoundrySkillServer {
  private server: Server;
  private api: SolFoundryApi;

  constructor() {
    this.server = new Server(
      {
        name: 'solfoundry-skill',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.api = new SolFoundryApi();
    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS,
    }));

    // Call a tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'list_bounties': return await this.handleListBounties(args);
          case 'get_bounty': return await this.handleGetBounty(args);
          case 'create_bounty': return await this.handleCreateBounty(args);
          case 'update_bounty': return await this.handleUpdateBounty(args);
          case 'delete_bounty': return await this.handleDeleteBounty(args);
          case 'batch_create_bounties': return await this.handleBatchCreateBounties(args);
          case 'submit_solution': return await this.handleSubmitSolution(args);
          case 'get_contributor': return await this.handleGetContributor(args);
          case 'list_contributors': return await this.handleListContributors(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`,
            );
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  // -----------------------------------------------------------------------
  // Tool Handlers
  // -----------------------------------------------------------------------

  private async handleListBounties(args: unknown) {
    const params = ListBountiesSchema.parse(args);
    const result = await this.api.listBounties(params);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Failed to fetch bounties: ${result.error}` }],
        isError: true,
      };
    }

    const bounties = result.data.bounties ?? [];
    const total = result.data.total ?? bounties.length;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            total,
            returned: bounties.length,
            status: params.status,
            tier: params.tier ?? 'all',
            bounties,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetBounty(args: unknown) {
    const params = GetBountySchema.parse(args);
    const result = await this.api.getBounty(params.bounty_id);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Bounty not found: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  }

  private async handleCreateBounty(args: unknown) {
    const params = CreateBountySchema.parse(args);
    const result = await this.api.createBounty(params);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Failed to create bounty: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  }

  private async handleUpdateBounty(args: unknown) {
    const params = UpdateBountySchema.parse(args);
    const { bounty_id, ...data } = params;
    const result = await this.api.updateBounty(bounty_id, data as Record<string, unknown>);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Failed to update bounty: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  }

  private async handleDeleteBounty(args: unknown) {
    const params = DeleteBountySchema.parse(args);
    const result = await this.api.deleteBounty(params.bounty_id);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Failed to delete bounty: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          deleted: true,
          bounty_id: params.bounty_id,
        }, null, 2),
      }],
    };
  }

  private async handleBatchCreateBounties(args: unknown) {
    const params = BatchCreateBountiesSchema.parse(args);
    const results: Array<{ index: number; status: string; bounty?: unknown; error?: string }> = [];

    for (let i = 0; i < params.bounties.length; i++) {
      const bounty = params.bounties[i];
      try {
        const result = await this.api.createBounty(bounty);
        if (result.ok) {
          const created = result.data as { id?: string };
          results.push({
            index: i,
            status: 'created',
            bounty: result.data,
          });

          // Publish if requested (update status from draft to open)
          if (params.publish && created?.id) {
            const pubResult = await this.api.updateBounty(created.id, { status: 'open' });
            if (pubResult.ok) {
              results[i].status = 'published';
            }
          }
        } else {
          results.push({ index: i, status: 'failed', error: result.error });
        }
      } catch (err) {
        results.push({
          index: i,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const created = results.filter((r) => r.status === 'created' || r.status === 'published').length;
    const published = results.filter((r) => r.status === 'published').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total: params.bounties.length,
          created,
          published,
          failed,
          publish_requested: params.publish,
          results,
        }, null, 2),
      }],
    };
  }

  private async handleSubmitSolution(args: unknown) {
    const params = SubmitSolutionSchema.parse(args);
    const { bounty_id, ...data } = params;
    const result = await this.api.submitSolution(bounty_id, data);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Failed to submit solution: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  }

  private async handleGetContributor(args: unknown) {
    const params = GetContributorSchema.parse(args);
    const result = await this.api.getContributor(params.username);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Contributor not found: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  }

  private async handleListContributors(args: unknown) {
    const params = ListContributorsSchema.parse(args);
    const result = await this.api.listContributors(params);

    if (!result.ok) {
      return {
        content: [{ type: 'text', text: `Failed to fetch contributors: ${result.error}` }],
        isError: true,
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total: result.data.total ?? result.data.contributors?.length ?? 0,
          contributors: result.data.contributors ?? [],
        }, null, 2),
      }],
    };
  }

  // -----------------------------------------------------------------------
  // Run
  // -----------------------------------------------------------------------

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    console.error('SolFoundry Skill MCP server starting...');
    await this.server.connect(transport);
    console.error('SolFoundry Skill MCP server running on stdio');
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const server = new SolFoundrySkillServer();
server.run().catch((err) => {
  console.error('Fatal error starting SolFoundry Skill server:', err);
  process.exit(1);
});