import * as vscode from 'vscode';
import { AuthManager } from './utils/auth';
import { ApiClient } from './api/client';
import { BountyProvider } from './bountyProvider';
import { claimBounty } from './commands/claim';
import { filterBounties, clearFilters } from './commands/filter';

let autoRefreshTimer: ReturnType<typeof setInterval> | undefined;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  const auth = new AuthManager(context);
  const client = new ApiClient(() => auth.getApiKey());
  const provider = new BountyProvider(client);

  // Tree data provider
  const treeView = vscode.window.createTreeView('solfoundry-bounties', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.command = 'solfoundry.refresh';
  statusBarItem.text = '$(search) SolFoundry: ...';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Update status bar when tree data changes
  provider.onDidChangeTreeData(() => {
    const open = provider.getTotalOpen();
    statusBarItem.text = `$(search) SolFoundry: ${open} open`;
  });

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundry.refresh', () => provider.refresh()),

    vscode.commands.registerCommand('solfoundry.filter', () => filterBounties(provider)),

    vscode.commands.registerCommand('solfoundry.clearFilters', () => clearFilters(provider)),

    vscode.commands.registerCommand('solfoundry.claim', async (item) => {
      const bounty = provider.getBountyAt(item);
      if (bounty) {
        await claimBounty(client, bounty);
        provider.refresh();
      }
    }),

    vscode.commands.registerCommand('solfoundry.openInBrowser', async (item) => {
      const bounty = provider.getBountyAt(item);
      if (bounty) {
        const url = bounty.githubIssueUrl
          ?? `https://solfoundry.vercel.app/bounties/${bounty.id}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
      }
    }),

    vscode.commands.registerCommand('solfoundry.setApiKey', async () => {
      await auth.promptForApiKey();
      provider.refresh();
    }),

    treeView
  );

  // Auto-refresh
  const config = vscode.workspace.getConfiguration('solfoundry');
  const interval = config.get<number>('autoRefreshInterval', 0);
  if (interval > 0) {
    autoRefreshTimer = setInterval(() => provider.refresh(), interval * 60_000);
    context.subscriptions.push({
      dispose: () => { if (autoRefreshTimer) { clearInterval(autoRefreshTimer); } },
    });
  }

  // Initial load
  provider.refresh();
}

export function deactivate(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  statusBarItem?.dispose();
}
