/**
 * SolFoundry MCP Server
 *
 * A Model Context Protocol server for Claude Code that enables
 * creating, updating, and managing SolFoundry bounties directly
 * from the Claude CLI.
 *
 * Tools:
 *   - solfoundry_list_bounties   — Browse open/completed bounties
 *   - solfoundry_get_bounty      — Get full details of a single bounty
 *   - solfoundry_create_bounty   — Create a new bounty
 *   - solfoundry_update_bounty   — Update an existing bounty
 *   - solfoundry_delete_bounty   — Cancel a bounty
 *   - solfoundry_batch_create    — Create multiple bounties from a config file
 *   - solfoundry_list_submissions — View submissions for a bounty
 *   - solfoundry_submit          — Submit a PR for a bounty
 *   - solfoundry_leaderboard     — View contributor leaderboard
 *   - solfoundry_stats           — View platform statistics
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { loadConfig } from './config.js';
import { registerTools } from './tools.js';

async function main() {
  const config = loadConfig();

  const server = new McpServer({
    name: 'solfoundry',
    version: '1.0.0',
  });

  registerTools(server, config);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('SolFoundry MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
