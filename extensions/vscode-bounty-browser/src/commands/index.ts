/**
 * Command handlers for the SolFoundry Bounty Browser extension.
 */

import * as vscode from 'vscode';
import type { BountyTreeDataProvider } from '../providers/BountyTreeDataProvider';
import type { BountyDetailPanel } from '../providers/BountyDetailProvider';
import type { Bounty, BountyStatus, BountyTier } from '../types/bounty';
import type { SolFoundryApiConfig } from '../api/bounties';

/**
 * Register all extension commands.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  treeDataProvider: BountyTreeDataProvider,
  getConfig: () => SolFoundryApiConfig
): void {
  // Refresh bounties
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.refresh', async () => {
      treeDataProvider.updateConfig(getConfig());
      await treeDataProvider.refresh();
    })
  );

  // Show bounty detail panel
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'solfoundryBounty.showDetail',
      async (bounty: Bounty) => {
        const { BountyDetailPanel } = await import('../providers/BountyDetailProvider');
        await BountyDetailPanel.createOrShow(bounty, getConfig());
      }
    )
  );

  // Submit claim for a bounty
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'solfoundryBounty.submitClaim',
      async (bounty: Bounty) => {
        const { BountyDetailPanel } = await import('../providers/BountyDetailProvider');
        const panel = await BountyDetailPanel.createOrShow(bounty, getConfig());
        // Panel will show the submission form
        void panel;
      }
    )
  );

  // Open bounty in browser
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'solfoundryBounty.openInBrowser',
      async (bounty: Bounty) => {
        const issueUrl = bounty.github_issue_url;
        if (issueUrl) {
          await vscode.env.openExternal(vscode.Uri.parse(issueUrl));
        } else {
          const apiUrl = getConfig().baseUrl;
          await vscode.env.openExternal(vscode.Uri.parse(`${apiUrl}/bounties/${bounty.id}`));
        }
      }
    )
  );

  // Set API URL
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.setApiUrl', async () => {
      const current = vscode.workspace.getConfiguration().get('solfoundryBounty.apiUrl', '');
      const newUrl = await vscode.window.showInputBox({
        prompt: 'Enter SolFoundry API base URL',
        value: current,
        placeHolder: 'http://localhost:8000',
        validateInput: (value) => {
          try {
            new URL(value);
            return null;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      });
      if (newUrl) {
        await vscode.workspace.getConfiguration().edit(
          'solfoundryBounty.apiUrl',
          newUrl,
          vscode.ConfigurationTarget.Global
        );
        treeDataProvider.updateConfig(getConfig());
        await treeDataProvider.refresh();
        vscode.window.showInformationMessage(`API URL set to ${newUrl}`);
      }
    })
  );

  // Set Auth Token
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.setAuthToken', async () => {
      const current = vscode.workspace.getConfiguration().get('solfoundryBounty.authToken', '');
      const newToken = await vscode.window.showInputBox({
        prompt: 'Enter SolFoundry JWT auth token',
        value: current,
        placeHolder: 'eyJhbGci...',
        password: true,
      });
      if (newToken !== undefined) {
        await vscode.workspace.getConfiguration().edit(
          'solfoundryBounty.authToken',
          newToken,
          vscode.ConfigurationTarget.Global
        );
        treeDataProvider.updateConfig(getConfig());
        await treeDataProvider.refresh();
        vscode.window.showInformationMessage('Auth token updated');
      }
    })
  );

  // Filter: Open bounties only
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.filterOpen', () => {
      treeDataProvider.setFilter({ ...treeDataProvider.getFilter(), status: 'open' });
      treeDataProvider.refresh();
    })
  );

  // Filter: All bounties
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.filterAll', () => {
      treeDataProvider.setFilter({ ...treeDataProvider.getFilter(), status: 'all' });
      treeDataProvider.refresh();
    })
  );

  // Filter: Tier 1
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.filterT1', () => {
      treeDataProvider.setFilter({ ...treeDataProvider.getFilter(), tier: 'T1' });
      treeDataProvider.refresh();
    })
  );

  // Filter: Tier 2
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.filterT2', () => {
      treeDataProvider.setFilter({ ...treeDataProvider.getFilter(), tier: 'T2' });
      treeDataProvider.refresh();
    })
  );

  // Filter: Tier 3
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.filterT3', () => {
      treeDataProvider.setFilter({ ...treeDataProvider.getFilter(), tier: 'T3' });
      treeDataProvider.refresh();
    })
  );

  // Search bounties (quick pick)
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.search', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'Search bounties by title, description, skills, or repo',
        placeHolder: 'Type to search...',
      });
      if (query !== undefined) {
        treeDataProvider.setFilter({
          ...treeDataProvider.getFilter(),
          searchQuery: query || undefined,
        });
        await treeDataProvider.refresh();
      }
    })
  );
}

/**
 * Get the current API configuration from VS Code settings.
 */
export function getApiConfig(): SolFoundryApiConfig {
  const config = vscode.workspace.getConfiguration('solfoundryBounty');
  return {
    baseUrl: config.get<string>('apiUrl', 'http://localhost:8000'),
    authToken: config.get<string>('authToken', '') || undefined,
  };
}
