import type { Command } from 'commander';
import type { SolFoundry } from '@solfoundry/sdk';
import { printError, printSuccess, c } from '../utils/output.js';

export async function deleteCommand(
  client: SolFoundry,
  bountyId: string,
): Promise<void> {
  if (!bountyId) {
    printError('Bounty ID is required.');
    process.exitCode = 1;
    return;
  }

  try {
    await client.bounties.delete(bountyId);
    printSuccess(`Bounty ${c.dim(bountyId)} deleted successfully.`);
  } catch (err) {
    printError(`Failed to delete bounty: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

export function registerDeleteCommand(program: Command, client: SolFoundry): void {
  program
    .command('delete <id>')
    .description('Delete a bounty permanently')
    .action(async (id: string) => {
      await deleteCommand(client, id);
    });
}
