#!/usr/bin/env node
/**
 * SolFoundry MCP Server — Entry Point
 *
 * Run with: node dist/server.js
 * Or via npx: npx @solfoundry/mcp-server
 */
export { default } from './server.js';

// Re-export for programmatic use
export { loadConfig } from './config.js';
export { registerTools } from './tools.js';
export * from './types.js';
