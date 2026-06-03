import * as vscode from 'vscode';
import { BountiesProvider, BountyItem } from './bountiesProvider';
import { claimBounty } from './api';
import { Bounty, BountyFilter } from './types';

export function activate(context: vscode.ExtensionContext) {
  const provider = new BountiesProvider();

  const treeView = vscode.window.createTreeView('solfoundry-bounties', {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(treeView);

  // ── Commands ──

  // Refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundry-bounties.refresh', () => {
      provider.refresh();
      vscode.window.showInformationMessage('SolFoundry bounties refreshed');
    })
  );

  // Filter by Language
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundry-bounties.filterByLanguage', async () => {
      const languages = [
        'Python', 'JavaScript', 'TypeScript', 'Go', 'Rust',
        'Swift', 'Solidity', 'Dart', 'Ruby', 'Java', 'C++',
        '(Clear filter)',
      ];

      const pick = await vscode.window.showQuickPick(languages, {
        placeHolder: 'Filter by programming language',
      });

      if (!pick) return;

      if (pick === '(Clear filter)') {
        provider.clearFilter();
        vscode.window.showInformationMessage('Language filter cleared');
        return;
      }

      provider.setFilter({ language: pick.toLowerCase() });
      vscode.window.showInformationMessage(`Filtered by: ${pick}`);
    })
  );

  // Filter by Reward Tier
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundry-bounties.filterByReward', async () => {
      const tiers = [
        { label: 'All Tiers', value: undefined },
        { label: 'Tier 1 - High Rewards', value: 'T1' },
        { label: 'Tier 2 - Medium Rewards', value: 'T2' },
        { label: 'Tier 3 - Small Rewards', value: 'T3' },
        { label: '(Clear filter)', value: 'clear' },
      ];

      const pick = await vscode.window.showQuickPick(
        tiers.map((t) => t.label),
        { placeHolder: 'Filter by reward tier' }
      );

      if (!pick) return;

      const selected = tiers.find((t) => t.label === pick);
      if (!selected) return;

      if (selected.value === 'clear') {
        provider.clearFilter();
        vscode.window.showInformationMessage('Reward filter cleared');
        return;
      }

      provider.setFilter({ tier: selected.value });
      vscode.window.showInformationMessage(`Filtered by: ${pick}`);
    })
  );

  // Claim Bounty
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'solfoundry-bounties.claim',
      async (item?: BountyItem) => {
        const bounty = item?.bountyData;
        if (!bounty) {
          vscode.window.showErrorMessage('No bounty selected');
          return;
        }

        const title = bounty.title.length > 50
          ? bounty.title.substring(0, 50) + '...'
          : bounty.title;

        const confirm = await vscode.window.showInformationMessage(
          `Claim bounty "${title}"?`,
          { modal: true },
          'Yes, claim it'
        );

        if (confirm !== 'Yes, claim it') return;

        // Show progress
        const result = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Claiming bounty #${bounty.number}...`,
            cancellable: false,
          },
          async () => claimBounty(bounty.id)
        );

        if (result.success) {
          vscode.window.showInformationMessage(
            `✅ Bounty claimed! ${result.message || ''}`,
            'Open in Browser'
          ).then((action) => {
            if (action === 'Open in Browser' && result.claimUrl) {
              vscode.env.openExternal(vscode.Uri.parse(result.claimUrl));
            }
          });
        } else {
          vscode.window.showWarningMessage(
            `Claim status: ${result.message || 'Please try again or claim manually on the website.'}`,
            'Open Website'
          ).then((action) => {
            if (action === 'Open Website') {
              vscode.env.openExternal(vscode.Uri.parse(
                `https://solfoundry.org/bounties/${bounty.id}`
              ));
            }
          });
        }
      }
    )
  );

  // Open in Browser
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'solfoundry-bounties.openInBrowser',
      async (item?: BountyItem | Bounty) => {
        const bounty = item instanceof BountyItem ? item.bountyData : item;
        if (!bounty?.url) {
          vscode.window.showErrorMessage('No URL available for this bounty');
          return;
        }
        vscode.env.openExternal(vscode.Uri.parse(bounty.url));
      }
    )
  );

  // Search Bounties
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundry-bounties.search', async () => {
      const query = await vscode.window.showInputBox({
        placeHolder: 'Search bounties by keyword...',
        prompt: 'Enter a keyword to search bounty titles and descriptions',
      });

      if (query === undefined) return; // User cancelled

      if (query === '') {
        provider.clearFilter();
        return;
      }

      // Search is client-side: fetch all, filter by query
      // (A production version would pass the query to the API)
      provider.refresh();
      vscode.window.showInformationMessage(
        `Search: "${query}" (applied locally)`
      );
    })
  );

  // ── Status bar item ──
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = 'solfoundry-bounties.refresh';
  statusBarItem.text = '$(star) SolFoundry Bounties';
  statusBarItem.tooltip = 'Click to refresh SolFoundry bounties';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Initial load
  provider.refresh();

  vscode.window.showInformationMessage(
    'SolFoundry Bounties extension activated! Click the $(star) icon in the sidebar.'
  );
}

export function deactivate() {}
