#!/usr/bin/env node
/**
 * Binary entry-point for the SolFoundry Auto-Submit Agent.
 *
 * Usage:
 *   node dist/bin.js --dry-run                  # discover + classify only
 *   node dist/bin.js                            # plan + implement + PR
 *   DRY_RUN=true node dist/bin.js               # env-driven dry-run
 *
 * Behaviour is driven by environment variables (see AgentConfig in ./src).
 */

import { loadAgentConfig, validateConfig } from './config.js';
import { createProvider } from './llm.js';
import { runAgent } from './index.js';
import path from 'node:path';

function parseArgs(): { dryRun?: boolean } {
  const out: { dryRun?: boolean } = {};
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') out.dryRun = true;
    if (arg === '--help') {
      console.log(`SolFoundry Auto-Submit Agent
Usage:  node dist/bin.js [--dry-run]

Flags:
  --dry-run   discover + classify only, no LLM / PR calls

Behaviour is driven by environment variables:
  SOLFOUNDRY_API_URL      (default https://api.solfoundry.io)
  SOLFOUNDRY_API_TOKEN    JWT for submission writes
  GITHUB_TOKEN            GitHub PAT (required when SUBMIT_PRS=true)
  LLM_BACKEND             claude | codex | gemini | openai | mock
  LLM_BASE_URL            self-hosted LLM base URL (e.g. http://localhost:8080/v1)
  LLM_MODEL               model name
  WORKSPACE               local sandbox for generated files
  SUBMIT_PRS              false to write files without opening a PR
  PAYOUT_WALLET           Solana wallet address appended to PR title
`);
      process.exit(0);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const cfg = loadAgentConfig();
  // CLI flag overrides env
  const effectiveCfg = args.dryRun ? { ...cfg, dryRun: true } : cfg;

  const missing = validateConfig(effectiveCfg);
  if (missing.length > 0) {
    console.error('[FATAL] Missing required environment variables:');
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }

  const provider = createProvider(effectiveCfg.llmBackend, {
    baseUrl: effectiveCfg.llmBaseUrl || undefined,
    model: effectiveCfg.llmModel,
    apiKey: effectiveCfg.authToken,
  });
  const workspace = path.resolve(
    process.env.WORKSPACE ?? path.join('.', 'agent-output'),
  );

  const result = await runAgent(effectiveCfg, provider, workspace);
  console.log('[INFO] Agent run finished:', JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
