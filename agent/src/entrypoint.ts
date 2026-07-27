#!/usr/bin/env tsx
/**
 * CLI entry-point for the SolFoundry Auto-Submit Agent.
 *
 * Usage:
 *   LLM_BACKEND=mock DRY_RUN=true node --import tsx src/main.ts   # discover + classify only
 *   LLM_BACKEND=mock SUBMIT_PRS=false node --import tsx src/main.ts   # implement to workspace
 *   node --import tsx src/main.ts                                    # full run (plan + PR)
 *
 * All behaviour is driven by environment variables (see AgentConfig).
 */

import { loadAgentConfig, validateConfig } from './config.js';
import { createProvider } from './llm.js';
import { runAgent } from './index.js';
import path from 'node:path';

async function main(): Promise<void> {
  const cfg = loadAgentConfig();
  const missing = validateConfig(cfg);
  if (missing.length > 0) {
    console.error('[FATAL] Missing required environment variables:');
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  const provider = createProvider(cfg.llmBackend, {
    baseUrl: cfg.llmBaseUrl || undefined,
    model: cfg.llmModel,
    apiKey: cfg.authToken,
  });
  const workspace = path.resolve(
    process.env.WORKSPACE ?? path.join('.', 'agent-output'),
  );

  const result = await runAgent(cfg, provider, workspace);
  console.log('[INFO] Agent run finished:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
