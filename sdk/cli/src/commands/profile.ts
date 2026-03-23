/**
 * `solfoundry profile <github-username>` — view contributor stats.
 *
 * Usage:
 *   solfoundry profile <github-username> [options]
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
  c,
} from '../utils/output.js';

export interface ProfileOptions {
  json: boolean;
}

export async function profileCommand(
  client: InstanceType<typeof SolFoundry>,
  username: string,
  options: ProfileOptions,
): Promise<void> {
  if (!username || username.trim() === '') {
    printError('github-username is required.', 'Usage: solfoundry profile <github-username>');
    process.exitCode = 1;
    return;
  }

  let contributor: Record<string, unknown>;
  try {
    contributor = (await client.contributors.get(username)) as Record<string, unknown>;
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.includes('404') || msg.includes('not found')) {
      printError(`Contributor "${username}" not found.`, 'Make sure the username is their GitHub username registered on SolFoundry.');
    } else {
      printError(`Failed to fetch profile: ${msg}`);
    }
    process.exitCode = 1;
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(contributor, null, 2));
    return;
  }

  const skills = (contributor.skills as string[] | undefined) ?? [];
  const badges = (contributor.badges as string[] | undefined) ?? [];

  printSection(`Contributor Profile — ${contributor.display_name ?? username}`);
  printKeyValue([
    ['Username', `@${contributor.username ?? username}`],
    ['Display Name', String(contributor.display_name ?? '—')],
    ['Reputation', c.bold(`${Number(contributor.reputation_score ?? 0).toFixed(1)} pts`)],
    ['Tier', contributor.tier ? `T${contributor.tier}` : c.dim('—')],
    ['Bounties Completed', String(contributor.total_bounties_completed ?? 0)],
    ['Total Earnings', `${Number(contributor.total_earnings ?? 0).toLocaleString()} $FNDRY`],
    ['Skills', skills.length > 0 ? skills.join(', ') : c.dim('—')],
    ['Badges', badges.length > 0 ? badges.map((b) => `🏅 ${b}`).join('  ') : c.dim('—')],
    ['Wallet', contributor.wallet_address ? String(contributor.wallet_address) : c.dim('Not linked')],
    ['Member Since', contributor.created_at ? new Date(String(contributor.created_at)).toLocaleDateString() : c.dim('—')],
  ]);
  console.log('');
}

export function registerProfileCommand(program: Command, client: InstanceType<typeof SolFoundry>): void {
  program
    .command('profile <github-username>')
    .description('View a contributor\'s stats, reputation, and earned badges')
    .option('--json', 'Output raw JSON', false)
    .action(async (username: string, opts: ProfileOptions) => {
      await profileCommand(client, username, opts);
    });
}
