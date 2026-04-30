/**
 * SolFoundry Bounty Browser - VS Code Extension
 *
 * Browse, search, filter, and submit claims for SolFoundry bounties
 * directly from VS Code.
 *
 * @see https://github.com/solfoundry/solfoundry/issues/854
 */

import * as vscode from 'vscode';
import { BountyTreeDataProvider } from './providers/BountyTreeDataProvider';
import { registerCommands, getApiConfig } from './commands';

/**
 * Activate the extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('SolFoundry Bounty Browser extension is now active.');

  // Initialize API config from settings
  const config = getApiConfig();

  // Create the tree data provider for the sidebar
  const treeDataProvider = new BountyTreeDataProvider(config);

  // Register the tree view
  const treeView = vscode.window.createTreeView('solfoundryBountyExplorer', {
    treeDataProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // Register all commands
  registerCommands(context, treeDataProvider, getApiConfig);

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('solfoundryBounty.apiUrl') ||
        e.affectsConfiguration('solfoundryBounty.authToken') ||
        e.affectsConfiguration('solfoundryBounty.defaultStatus')
      ) {
        treeDataProvider.updateConfig(getApiConfig());
        treeDataProvider.refresh();
      }
    })
  );

  // Initial load
  treeDataProvider.refresh();

  // Register search command in command palette
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

  // Quick pick for bounty selection
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundryBounty.quickOpen', async () => {
      const bounties = treeDataProvider.getBounties();
      if (bounties.length === 0) {
        vscode.window.showWarningMessage('No bounties loaded. Try refreshing first.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        bounties.map((b) => ({
          label: `$(star) ${b.title}`,
          description: `${b.tier} • ${b.reward_amount} ${b.reward_token}`,
          detail: `${b.org_name || 'Unknown'}/${b.repo_name || 'repo'} | ${b.skills.join(', ')}`,
          bounty: b,
        })),
        {
          placeHolder: 'Select a bounty to view details',
          matchOnDescription: true,
          matchOnDetail: true,
        }
      );

      if (selected) {
        const { BountyDetailPanel } = await import('./providers/BountyDetailProvider');
        await BountyDetailPanel.createOrShow(selected.bounty, getApiConfig());
      }
    })
  );
}

/**
 * Deactivate the extension.
 */
export function deactivate(): void {
  // Clean up is handled by disposables
}
