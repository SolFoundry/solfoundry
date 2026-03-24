/**
 * `solfoundry status <bounty-id>` — check bounty status and escrow state.
 *
 * Usage:
 *   solfoundry status <bounty-id> [options]
 *
 * Options:
 *   --json   Output raw JSON
 */

import type { Command } from 'commander';
import type { SolFoundry } from '@solfoundry/sdk';
import {
  printKeyValue,
  printError,
  printSection,
  statusBadge,
  c,
} from '../utils/output.js';

export interface StatusOptions {
  json: boolean;
}

export async function statusCommand(
  client: InstanceType<typeof SolFoundry>,
  bountyId: string,
  options: StatusOptions,
): Promise<void> {
  if (!bountyId || bountyId.trim() === '') {
    printError('bounty-id is required.', 'Usage: solfoundry status <bounty-id>');
    process.exitCode = 1;
    return;
  }

  let bounty: Record<string, unknown>;
  let escrow: Record<string, unknown> | null = null;

  try {
    bounty = (await client.bounties.get(bountyId)) as Record<string, unknown>;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('404') || msg.includes('not found')) {
      printError(`Bounty "${bountyId}" not found.`);
    } else {
      printError(`Failed to fetch bounty: ${msg}`);
    }
    process.exitCode = 1;
    return;
  }

  try {
    escrow = (await client.escrow.getStatus(bountyId)) as Record<string, unknown>;
  } catch {
    // escrow may not exist yet — non-fatal
  }

  if (options.json) {
    console.log(JSON.stringify({ bounty, escrow }, null, 2));
    return;
  }

  printSection('Bounty Status');
  printKeyValue([
    ['ID', c.dim(String(bounty.id ?? bountyId))],
    ['Title', c.bold(String(bounty.title ?? '—'))],
    ['Status', statusBadge(String(bounty.status ?? 'unknown'))],
    ['Tier', `T${bounty.tier ?? '?'}`],
    ['Reward', `${Number(bounty.reward_amount ?? 0).toLocaleString()} $FNDRY`],
    ['Created By', String(bounty.created_by ?? '—')],
    ['Deadline', bounty.deadline ? new Date(String(bounty.deadline)).toLocaleString() : c.dim('—')],
    ['Description', String(bounty.description ?? '—').slice(0, 120) + (String(bounty.description ?? '').length > 120 ? '…' : '')],
  ]);

  if (escrow) {
    printSection('Escrow');
    printKeyValue([
      ['State', statusBadge(String(escrow.state ?? 'unknown'))],
      ['Amount Locked', `${Number(escrow.amount ?? 0).toLocaleString()} $FNDRY`],
      ['Creator Wallet', String(escrow.creator_wallet ?? '—')],
      ['Winner Wallet', escrow.winner_wallet ? String(escrow.winner_wallet) : c.dim('—')],
      ['Expires At', escrow.expires_at ? new Date(String(escrow.expires_at)).toLocaleString() : c.dim('—')],
    ]);
  } else {
    console.log(`\n  ${c.dim('No escrow record found for this bounty.')}`);
  }

  console.log('');
}

export function registerStatusCommand(program: Command, client: InstanceType<typeof SolFoundry>): void {
  program
    .command('status <bounty-id>')
    .description('Check the status and escrow state of a specific bounty')
    .option('--json', 'Output raw JSON', false)
    .action(async (bountyId: string, opts: StatusOptions) => {
      await statusCommand(client, bountyId, opts);
    });
}
