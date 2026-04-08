import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import type { Bounty } from '../types';

export async function claimBounty(client: ApiClient, bounty: Bounty): Promise<void> {
  if (bounty.status !== 'open') {
    vscode.window.showWarningMessage(`Bounty "${bounty.title}" is not open for claiming (status: ${bounty.status}).`);
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Claim bounty "${bounty.title}" (${bounty.reward} ${bounty.rewardToken ?? ''})?`,
    { modal: true },
    'Claim'
  );
  if (confirm !== 'Claim') {
    return;
  }

  const notes = await vscode.window.showInputBox({
    prompt: 'Optional notes for your claim',
    placeHolder: 'I plan to...',
    ignoreFocusOut: true,
  });

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Claiming bounty...',
        cancellable: false,
      },
      () => client.claimBounty(bounty.id, notes ?? undefined)
    );
    vscode.window.showInformationMessage(`Successfully claimed: ${bounty.title}`);
  } catch (err) {
    vscode.window.showErrorMessage(
      `Failed to claim bounty: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
