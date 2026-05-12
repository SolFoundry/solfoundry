import type { Command } from 'commander';
import type { SolFoundry, BountyCreate } from '@solfoundry/sdk';
import { printError, printSuccess, printSection, c } from '../utils/output.js';
import fs from 'node:fs/promises';

export async function batchCreateCommand(
  client: SolFoundry,
  filePath: string,
): Promise<void> {
  if (!filePath) {
    printError('Config file path is required.', 'Usage: solfoundry batch create <file.json>');
    process.exitCode = 1;
    return;
  }

  let configData: BountyCreate[];
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    configData = JSON.parse(raw);
    if (!Array.isArray(configData)) {
      throw new Error('Config file must contain a JSON array of bounties.');
    }
  } catch (err) {
    printError(`Failed to read or parse config file: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  printSection(`Batch Creating ${configData.length} Bounties`);
  
  let successCount = 0;
  let failCount = 0;

  for (const [index, bountyData] of configData.entries()) {
    try {
      const created = await client.bounties.create(bountyData);
      console.log(`  ${c.success('✔')} [${index + 1}/${configData.length}] Created: ${c.bold(created.title)} (${created.id.slice(0, 8)})`);
      successCount++;
    } catch (err) {
      console.error(`  ${c.error('✖')} [${index + 1}/${configData.length}] Failed: ${bountyData.title || 'Unknown'} — ${(err as Error).message}`);
      failCount++;
    }
  }

  console.log('\n' + '─'.repeat(40));
  if (successCount > 0) printSuccess(`Successfully created ${successCount} bounties.`);
  if (failCount > 0) printError(`Failed to create ${failCount} bounties.`);
  console.log('');
}

export function registerBatchCommand(program: Command, client: SolFoundry): void {
  const batch = program
    .command('batch')
    .description('Manage bounties in bulk');

  batch
    .command('create <file>')
    .description('Batch create bounties from a JSON config file')
    .action(async (file: string) => {
      await batchCreateCommand(client, file);
    });
}
