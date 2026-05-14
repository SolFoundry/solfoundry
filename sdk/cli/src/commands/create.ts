import type { Command } from 'commander';
import { SolFoundry, BountyTier } from '@solfoundry/sdk';
import { printError, printSuccess, printSection, printKeyValue, c } from '../utils/output.js';

export interface CreateOptions {
  title: string;
  reward: string;
  description?: string;
  tier?: string;
  category?: string;
  skills?: string;
  deadline?: string;
  json: boolean;
}

export async function createCommand(
  client: SolFoundry,
  options: CreateOptions,
): Promise<void> {
  if (!options.title) {
    printError('Title is required.', 'Use --title <string>');
    process.exitCode = 1;
    return;
  }

  if (!options.reward) {
    printError('Reward amount is required.', 'Use --reward <number>');
    process.exitCode = 1;
    return;
  }

  const reward_amount = parseFloat(options.reward);
  if (isNaN(reward_amount)) {
    printError('Invalid reward amount.', '--reward must be a number.');
    process.exitCode = 1;
    return;
  }

  const tier = options.tier ? parseInt(options.tier, 10) : undefined;
  if (tier !== undefined && ![1, 2, 3].includes(tier)) {
    printError('--tier must be 1, 2, or 3');
    process.exitCode = 1;
    return;
  }

  const required_skills = options.skills ? options.skills.split(',').map(s => s.trim()) : undefined;

  try {
    const bounty = await client.bounties.create({
      title: options.title,
      reward_amount,
      description: options.description || '',
      tier: tier as BountyTier,
      category: options.category,
      required_skills,
      deadline: options.deadline,
    });

    if (options.json) {
      console.log(JSON.stringify(bounty, null, 2));
      return;
    }

    printSuccess('Bounty created successfully!');
    printSection('New Bounty Details');
    printKeyValue([
      ['ID', c.bold(bounty.id)],
      ['Title', bounty.title],
      ['Tier', `T${bounty.tier}`],
      ['Reward', `${bounty.reward_amount.toLocaleString()} $FNDRY`],
      ['Status', c.success(bounty.status.toUpperCase())],
    ]);
    console.log(`\n  View at: ${c.info(`https://solfoundry.io/bounties/${bounty.id}`)}\n`);
  } catch (err) {
    printError(`Failed to create bounty: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

export function registerCreateCommand(program: Command, client: SolFoundry): void {
  program
    .command('create')
    .description('Create a new bounty on SolFoundry')
    .requiredOption('--title <string>', 'Bounty title')
    .requiredOption('--reward <number>', 'Reward amount in $FNDRY')
    .option('--description <string>', 'Detailed description in Markdown')
    .option('--tier <number>', 'Difficulty tier (1, 2, 3)')
    .option('--category <string>', 'Category (frontend, backend, etc.)')
    .option('--skills <comma-separated>', 'Required skills')
    .option('--deadline <iso-date>', 'ISO 8601 deadline')
    .option('--json', 'Output raw JSON', false)
    .action(async (opts: CreateOptions) => {
      await createCommand(client, opts);
    });
}
