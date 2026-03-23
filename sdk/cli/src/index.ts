#!/usr/bin/env node
/**
 * SolFoundry CLI — `npx @solfoundry/cli`
 *
 * Commands:
 *   bounties             List open bounties
 *   status <bounty-id>  Check bounty + escrow status
 *   profile <username>  View contributor profile and stats
 *   verify <tx-hash>    Verify on-chain bounty completion
 */

import { Command } from 'commander';
import { createClient } from './utils/client.js';
import { registerBountiesCommand } from './commands/bounties.js';
import { registerStatusCommand } from './commands/status.js';
import { registerProfileCommand } from './commands/profile.js';
import { registerVerifyCommand } from './commands/verify.js';

const program = new Command();
const client = createClient();

program
  .name('solfoundry')
  .description('CLI for the SolFoundry bounty marketplace')
  .version('1.0.0')
  .addHelpText(
    'after',
    `
Environment variables:
  SOLFOUNDRY_BASE_URL   API base URL (default: https://api.solfoundry.io)
  SOLFOUNDRY_TOKEN      JWT auth token for authenticated requests

Examples:
  $ solfoundry bounties
  $ solfoundry bounties --tier 2 --limit 5
  $ solfoundry status abc123
  $ solfoundry profile octocat
  $ solfoundry verify 5KtP...TxHash
    `,
  );

registerBountiesCommand(program, client);
registerStatusCommand(program, client);
registerProfileCommand(program, client);
registerVerifyCommand(program);

program.parse();
