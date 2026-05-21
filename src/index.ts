#!/usr/bin/env node
/**
 * SolFoundry MCP Server
 * 
 * Claude Code MCP server that wraps the SolFoundry SDK for bounty operations.
 * Provides tools: list_bounties, get_bounty, create_bounty, update_bounty, delete_bounty, submit_solution.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Types (mirroring SolFoundry SDK types.ts)
// ---------------------------------------------------------------------------

enum BountyTier {
  T1 = 1,
  T2 = 2,
  T3 = 3,
}

enum BountyStatus {
  DRAFT = "draft",
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  UNDER_REVIEW = "under_review",
  COMPLETED = "completed",
  DISPUTED = "disputed",
  PAID = "paid",
  CANCELLED = "cancelled",
}

interface BountyCreate {
  title: string;
  description?: string;
  reward_amount?: number;
  tier?: BountyTier;
  repository_url?: string;
  acceptance_criteria?: string;
}

interface BountyUpdate {
  title?: string;
  description?: string;
  reward_amount?: number;
  status?: BountyStatus;
}

interface SubmissionCreate {
  bounty_id: string;
  pr_url: string;
  contributor_wallet?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// SolFoundry API Client
// ---------------------------------------------------------------------------

interface SolFoundryConfig {
  baseUrl: string;
  apiKey?: string;
}

class SolFoundryClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: SolFoundryConfig = { baseUrl: "https://app.solfoundry.xyz" }) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey || process.env.SOLFOUNDRY_API_KEY;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SolFoundry API error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async listBounties(options?: {
    status?: BountyStatus;
    tier?: BountyTier;
    skip?: number;
    limit?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.tier) params.set("tier", String(options.tier));
    if (options?.skip != null) params.set("skip", String(options.skip));
    if (options?.limit) params.set("limit", String(options.limit));
    const query = params.toString();
    return this.request(`/api/bounties${query ? `?${query}` : ""}`);
  }

  async getBounty(bountyId: string): Promise<any> {
    return this.request(`/api/bounties/${bountyId}`);
  }

  async createBounty(data: BountyCreate): Promise<any> {
    return this.request("/api/bounties", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBounty(bountyId: string, data: BountyUpdate): Promise<any> {
    return this.request(`/api/bounties/${bountyId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteBounty(bountyId: string): Promise<void> {
    await this.request(`/api/bounties/${bountyId}`, { method: "DELETE" });
  }

  async submitSolution(data: SubmissionCreate): Promise<any> {
    return this.request(`/api/bounties/${data.bounty_id}/submissions`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

// ---------------------------------------------------------------------------
// Server Setup
// ---------------------------------------------------------------------------

const SOLFOUNDRY_API_KEY = process.env.SOLFOUNDRY_API_KEY;
const client = new SolFoundryClient({ apiKey: SOLFOUNDRY_API_KEY });

const server = new Server(
  {
    name: "solfoundry-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: "list_bounties",
    description: "List SolFoundry bounties with optional filtering by status and tier.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "open", "in_progress", "under_review", "completed", "disputed", "paid", "cancelled"],
          description: "Filter by bounty lifecycle status",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description: "Filter by bounty tier (1=T1, 2=T2, 3=T3)",
        },
        limit: {
          type: "number",
          description: "Number of results (default 20, max 100)",
          default: 20,
        },
        skip: {
          type: "number",
          description: "Pagination offset",
          default: 0,
        },
      },
    },
  },
  {
    name: "get_bounty",
    description: "Get full details for a specific SolFoundry bounty by its UUID.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: {
          type: "string",
          description: "The UUID of the bounty to retrieve",
        },
      },
      required: ["bounty_id"],
    },
  },
  {
    name: "create_bounty",
    description: "Create a new SolFoundry bounty. Requires SOLFOUNDRY_API_KEY environment variable.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Bounty title",
        },
        description: {
          type: "string",
          description: "Detailed bounty description",
        },
        reward_amount: {
          type: "number",
          description: "Reward amount in $FNDRY",
        },
        tier: {
          type: "number",
          enum: [1, 2, 3],
          description: "Bounty tier (1=T1, 2=T2, 3=T3)",
          default: 1,
        },
        repository_url: {
          type: "string",
          description: "GitHub repository URL",
        },
        acceptance_criteria: {
          type: "string",
          description: "Acceptance criteria for the bounty",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_bounty",
    description: "Update an existing SolFoundry bounty. Requires SOLFOUNDRY_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: {
          type: "string",
          description: "UUID of the bounty to update",
        },
        title: {
          type: "string",
          description: "New title",
        },
        description: {
          type: "string",
          description: "New description",
        },
        reward_amount: {
          type: "number",
          description: "New reward amount",
        },
        status: {
          type: "string",
          enum: ["draft", "open", "in_progress", "under_review", "completed", "disputed", "paid", "cancelled"],
          description: "New status",
        },
      },
      required: ["bounty_id"],
    },
  },
  {
    name: "delete_bounty",
    description: "Delete a SolFoundry bounty. Requires SOLFOUNDRY_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: {
          type: "string",
          description: "UUID of the bounty to delete",
        },
      },
      required: ["bounty_id"],
    },
  },
  {
    name: "submit_solution",
    description: "Submit a solution (PR) to a SolFoundry bounty. Requires SOLFOUNDRY_API_KEY.",
    inputSchema: {
      type: "object",
      properties: {
        bounty_id: {
          type: "string",
          description: "UUID of the bounty to submit solution for",
        },
        pr_url: {
          type: "string",
          description: "GitHub PR URL of your solution",
        },
        contributor_wallet: {
          type: "string",
          description: "Solana wallet address for payout (32-64 chars)",
        },
        notes: {
          type: "string",
          description: "Optional notes about the submission",
        },
      },
      required: ["bounty_id", "pr_url"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_bounties": {
        const result = await client.listBounties(args as any);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_bounty": {
        const { bounty_id } = args as { bounty_id: string };
        const result = await client.getBounty(bounty_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "create_bounty": {
        if (!SOLFOUNDRY_API_KEY) {
          return {
            content: [
              {
                type: "text",
                text: "Error: SOLFOUNDRY_API_KEY environment variable is not set. Set it with: export SOLFOUNDRY_API_KEY=your_key",
              },
            ],
            isError: true,
          };
        }
        const result = await client.createBounty(args as BountyCreate);
        return {
          content: [
            {
              type: "text",
              text: `Bounty created successfully!\nID: ${result.id}\nTitle: ${result.title}\nStatus: ${result.status}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case "update_bounty": {
        if (!SOLFOUNDRY_API_KEY) {
          return {
            content: [
              {
                type: "text",
                text: "Error: SOLFOUNDRY_API_KEY environment variable is not set.",
              },
            ],
            isError: true,
          };
        }
        const { bounty_id, ...updateData } = args as any;
        const result = await client.updateBounty(bounty_id, updateData);
        return {
          content: [
            {
              type: "text",
              text: `Bounty ${bounty_id} updated successfully!\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      case "delete_bounty": {
        if (!SOLFOUNDRY_API_KEY) {
          return {
            content: [
              {
                type: "text",
                text: "Error: SOLFOUNDRY_API_KEY environment variable is not set.",
              },
            ],
            isError: true,
          };
        }
        const { bounty_id } = args as { bounty_id: string };
        await client.deleteBounty(bounty_id);
        return {
          content: [
            {
              type: "text",
              text: `Bounty ${bounty_id} deleted successfully.`,
            },
          ],
        };
      }

      case "submit_solution": {
        if (!SOLFOUNDRY_API_KEY) {
          return {
            content: [
              {
                type: "text",
                text: "Error: SOLFOUNDRY_API_KEY environment variable is not set.",
              },
            ],
            isError: true,
          };
        }
        const { bounty_id, pr_url, contributor_wallet, notes } = args as any;
        const result = await client.submitSolution({
          bounty_id,
          pr_url,
          contributor_wallet,
          notes,
        });
        return {
          content: [
            {
              type: "text",
              text: `Solution submitted to bounty ${bounty_id}!\nPR: ${pr_url}\nSubmission ID: ${result.id}\nStatus: ${result.status}\n\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SolFoundry MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
