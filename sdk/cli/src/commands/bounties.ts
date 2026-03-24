/**
 * `solfoundry bounties` — list open bounties.
 *
 * Usage:
 *   solfoundry bounties [options]
 *
 * Options:
 *   -s, --status <status>   Filter by status (default: open)
 *   -t, --tier <tier>       Filter by tier (1, 2, or 3)
 *   -l, --limit <n>         Number of results (default: 20)
 *   --json                  Output raw JSON
 */

import type { Command } from 'commander';
import type { SolFoundry } from '@solfoundry/sdk';
import { printBountiesTable, printError, printSection, c } from '../utils/output.js';

export interface BountiesOptions {
  status: string;
  tier?: string;
  limit: string;
  json: boolean;
}

export async function bountiesCommand(
  client: InstanceType<typeof SolFoundry>,
  options: BountiesOptions,
): Promise<void> {
  const limit = Math.max(1, Math.min(100, parseInt(options.limit, 10) || 20));
  const tier = options.tier ? parseInt(options.tier, 10) : undefined;

  if (tier !== undefined && ![1, 2, 3].includes(tier)) {
    printError('--tier must be 1, 2, or 3');
    process.exitCode = 1;
    return;
  }

  let result;
  try {
    result = await client.bounties.list({
      status: options.status as 'open',
      limit,
      ...(tier ? { tier } : {}),
    });
  } catch (err) {
    printError(`Failed to fetch bounties: ${(err as Error).message}`, 'Check your SOLFOUNDRY_BASE_URL and network connection.');
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const bounties = result.bounties ?? result.items ?? (Array.isArray(result) ? result : []);

  if (bounties.length === 0) {
    console.log(c.dim(`\n  No ${options.status} bounties found.\n`));
    return;
  }

  printSection(`${options.status.toUpperCase()} Bounties (${bounties.length})`);
  printBountiesTable(
    bounties.map((b: Record<string, unknown>) => ({
      id: String(b.id ?? ''),
      title: String(b.title ?? ''),
      tier: Number(b.tier ?? 1),
      reward: Number(b.reward_amount ?? 0),
      status: String(b.status ?? 'open'),
      deadline: b.deadline ? String(b.deadline) : null,
    })),
  );
  console.log(c.dim(`\n  Showing ${bounties.length} of ${result.total ?? bounties.length} results.\n`));
}

export function registerBountiesCommand(program: Command, client: InstanceType<typeof SolFoundry>): void {
  program
    .command('bounties')
    .description('List open bounties on the SolFoundry marketplace')
    .option('-s, --status <status>', 'Filter by status (open, in_progress, completed)', 'open')
    .option('-t, --tier <tier>', 'Filter by tier (1, 2, or 3)')
    .option('-l, --limit <n>', 'Number of results to return', '20')
    .option('--json', 'Output raw JSON', false)
    .action(async (opts: BountiesOptions) => {
      await bountiesCommand(client, opts);
    });
}
