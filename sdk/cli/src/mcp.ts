import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { SolFoundry, BountyTier } from "@solfoundry/sdk";
import { loadConfig } from "./utils/config.js";

export class SolFoundryMcpServer {
  private server: Server;
  private client: SolFoundry;

  constructor() {
    const config = loadConfig();
    this.client = SolFoundry.create({
      baseUrl: config.baseUrl,
      authToken: config.authToken,
    });

    this.server = new Server(
      {
        name: "solfoundry-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_bounties",
          description: "List available bounties on SolFoundry with optional filters",
          inputSchema: {
            type: "object",
            properties: {
              status: { type: "string", description: "Filter by status (open, in_progress, completed)", default: "open" },
              tier: { type: "number", description: "Filter by tier (1, 2, 3)" },
              limit: { type: "number", description: "Max results", default: 10 }
            },
          },
        },
        {
          name: "get_bounty",
          description: "Get full details of a specific bounty by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "The UUID of the bounty" },
            },
            required: ["id"],
          },
        },
        {
          name: "create_bounty",
          description: "Create a new bounty on the marketplace",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Bounty title" },
              reward_amount: { type: "number", description: "Reward in $FNDRY" },
              description: { type: "string", description: "Markdown description" },
              tier: { type: "number", description: "Difficulty tier (1, 2, 3)" },
              category: { type: "string", description: "Category (frontend, backend, etc.)" }
            },
            required: ["title", "reward_amount"],
          },
        },
        {
          name: "update_bounty",
          description: "Update an existing bounty's details or status",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "The UUID of the bounty" },
              status: { type: "string", description: "New status" },
              title: { type: "string", description: "Updated title" },
              reward_amount: { type: "number", description: "Updated reward" }
            },
            required: ["id"],
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case "list_bounties": {
            const args = request.params.arguments as any;
            const result = await this.client.bounties.list({
              status: args.status || "open",
              tier: args.tier,
              limit: args.limit || 10
            });
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }
          case "get_bounty": {
            const args = request.params.arguments as any;
            const result = await this.client.bounties.get(args.id);
            return {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            };
          }
          case "create_bounty": {
            const args = request.params.arguments as any;
            const result = await this.client.bounties.create({
              title: args.title,
              reward_amount: args.reward_amount,
              description: args.description,
              tier: args.tier as BountyTier,
              category: args.category
            });
            return {
              content: [{ type: "text", text: `Bounty created successfully: ${result.id}` }],
            };
          }
          case "update_bounty": {
            const args = request.params.arguments as any;
            const { id, ...data } = args;
            const result = await this.client.bounties.update(id, data);
            return {
              content: [{ type: "text", text: `Bounty ${id} updated successfully.` }],
            };
          }
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("SolFoundry MCP server running on stdio");
  }
}

export function registerMcpCommand(program: any) {
  program
    .command('mcp')
    .description('Start the SolFoundry MCP server for Claude Code integration')
    .action(async () => {
      const mcpServer = new SolFoundryMcpServer();
      await mcpServer.run();
    });
}
