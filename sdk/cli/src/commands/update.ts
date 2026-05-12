import type { Command } from 'commander';
import { SolFoundry, BountyStatus } from '@solfoundry/sdk';
import { printError, printSuccess, printSection, printKeyValue, c } from '../utils/output.js';

export interface UpdateOptions {
  title?: string;
  reward?: string;
  description?: string;
  status?: string;
  skills?: string;
  deadline?: string;
  json: boolean;
}

export async function updateCommand(
  client: SolFoundry,
  bountyId: string,
  options: UpdateOptions,
): Promise<void> {
  if (!bountyId) {
    printError('Bounty ID is required.');
    process.exitCode = 1;
    return;
  }

  const reward_amount = options.reward ? parseFloat(options.reward) : undefined;
  if (options.reward && isNaN(reward_amount!)) {
    printError('Invalid reward amount.', '--reward must be a number.');
    process.exitCode = 1;
    return;
  }

  const required_skills = options.skills ? options.skills.split(',').map(s => s.trim()) : undefined;

  try {
    const bounty = await client.bounties.update(bountyId, {
      title: options.title,
      reward_amount,
      description: options.description,
      status: options.status as BountyStatus,
      required_skills,
      deadline: options.deadline,
    });

    if (options.json) {
      console.log(JSON.stringify(bounty, null, 2));
      return;
    }

    printSuccess('Bounty updated successfully!');
    printSection('Updated Bounty Details');
    printKeyValue([
      ['ID', c.dim(bounty.id)],
      ['Title', bounty.title],
      ['Status', c.info(bounty.status.toUpperCase())],
      ['Reward', `${bounty.reward_amount.toLocaleString()} $FNDRY`],
    ]);
    console.log('');
  } catch (err) {
    printError(`Failed to update bounty: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

export function registerUpdateCommand(program: Command, client: SolFoundry): void {
  program
    .command('update <id>')
    .description('Update an existing bounty')
    .option('--title <string>', 'Updated title')
    .option('--reward <number>', 'Updated reward amount')
    .option('--description <string>', 'Updated description')
    .option('--status <string>', 'New status (open, in_progress, completed, cancelled)')
    .option('--skills <comma-separated>', 'Updated skills')
    .option('--deadline <iso-date>', 'Updated deadline')
    .option('--json', 'Output raw JSON', false)
    .action(async (id: string, opts: UpdateOptions) => {
      await updateCommand(client, id, opts);
    });
}
