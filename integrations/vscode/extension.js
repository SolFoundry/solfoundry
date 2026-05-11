const vscode = require('vscode');
const https = require('https');

// --- API Client ---

const API_BASE = 'https://solfoundry.xyz/api';

function fetchJSON(path) {
  return new Promise((resolve, reject) => {
    https.get(`${API_BASE}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

// --- Tree Data Provider ---

class BountyTreeDataProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.bounties = [];
    this.filter = { tier: null, language: null };
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  async getChildren(element) {
    if (!element) {
      // Root: show filter + bounty list
      const items = [];

      // Filter indicators
      if (this.filter.tier || this.filter.language) {
        items.push({
          label: `$(filter) Filter: ${this.filter.tier || 'All tiers'} · ${this.filter.language || 'All languages'}`,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          command: { command: 'solfoundry.clearFilter', title: 'Clear Filter' },
          contextValue: 'filter',
        });
      }

      // Bounty items
      for (const b of this.bounties) {
        const tierIcon = { T1: '🟢', T2: '🟡', T3: '🟣' }[b.tier] || '⚪';
        const rewardStr = b.reward >= 1000000 ? `${b.reward / 1000000}M` : `${b.reward / 1000}K`;

        items.push({
          label: `${tierIcon} ${b.title}`,
          description: `${rewardStr} $FNDRY`,
          tooltip: `${b.title}\nReward: ${b.reward.toLocaleString()} $FNDRY\nTier: ${b.tier}\nSkills: ${(b.skills || []).join(', ')}\n\n${b.description || ''}`,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
          command: {
            command: 'solfoundry.openBounty',
            title: 'Open Bounty',
            arguments: [b],
          },
          contextValue: 'bounty',
          bounty: b,
        });
      }

      if (this.bounties.length === 0) {
        items.push({
          label: '$(sync~spin) Loading bounties...',
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        });
      }

      return items;
    }
    return [];
  }

  getTreeItem(element) {
    const item = new vscode.TreeItem(element.label, element.collapsibleState);
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.contextValue = element.contextValue;
    if (element.command) {
      item.command = element.command;
    }
    // Color by tier
    if (element.bounty) {
      const tier = element.bounty.tier;
      if (tier === 'T1') item.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.green'));
      else if (tier === 'T2') item.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.yellow'));
      else if (tier === 'T3') item.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.purple'));
    }
    return item;
  }
}

// --- Activation ---

function activate(context) {
  const provider = new BountyTreeDataProvider();

  // Tree View
  const treeView = vscode.window.createTreeView('solfoundry-bounties', {
    treeDataProvider: provider,
    showCollapseAll: false,
  });

  // Load bounties
  async function loadBounties() {
    try {
      const bounties = await fetchJSON('/bounties?status=open');
      provider.bounties = bounties;

      // Apply filters
      if (provider.filter.tier) {
        provider.bounties = provider.bounties.filter(b => b.tier === provider.filter.tier);
      }
      if (provider.filter.language) {
        provider.bounties = provider.bounties.filter(b =>
          (b.skills || []).some(s => s.toLowerCase().includes(provider.filter.language.toLowerCase()))
        );
      }

      // Sort by reward (high to low)
      provider.bounties.sort((a, b) => (b.reward || 0) - (a.reward || 0));
      provider.refresh();

      // Status bar
      vscode.window.setStatusBarMessage(`SolFoundry: ${provider.bounties.length} bounties loaded`, 3000);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to load bounties: ${e.message}`);
    }
  }

  // Commands
  const cmds = [
    vscode.commands.registerCommand('solfoundry.refresh', () => {
      loadBounties();
    }),

    vscode.commands.registerCommand('solfoundry.openBounty', (bounty) => {
      if (bounty && bounty.url) {
        vscode.env.openExternal(vscode.Uri.parse(bounty.url));
      } else if (bounty && bounty.id) {
        vscode.env.openExternal(vscode.Uri.parse(`https://solfoundry.xyz/bounties/${bounty.id}`));
      }
    }),

    vscode.commands.registerCommand('solfoundry.claimBounty', (bounty) => {
      if (bounty && bounty.id) {
        const terminal = vscode.window.createTerminal(`Bounty #${bounty.id}`);
        terminal.sendText(`# Claim bounty #${bounty.id}: ${bounty.title}`);
        terminal.sendText(`gh issue view ${bounty.id} --repo SolFoundry/solfoundry`);
        terminal.sendText(`# Fork and create branch:`);
        terminal.sendText(`gh repo fork SolFoundry/solfoundry --clone`);
        terminal.show();
      }
    }),

    vscode.commands.registerCommand('solfoundry.filterByTier', async () => {
      const tiers = ['All', 'T1 (🟢 Quick)', 'T2 (🟡 Standard)', 'T3 (🟣 Complex)'];
      const selected = await vscode.window.showQuickPick(tiers, { placeHolder: 'Filter by tier' });
      if (selected === 'All' || !selected) {
        provider.filter.tier = null;
      } else {
        provider.filter.tier = selected.split(' ')[0]; // T1, T2, or T3
      }
      loadBounties();
    }),

    vscode.commands.registerCommand('solfoundry.filterByLanguage', async () => {
      const langs = ['All', 'TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Java', 'Solidity'];
      const selected = await vscode.window.showQuickPick(langs, { placeHolder: 'Filter by language' });
      if (selected === 'All' || !selected) {
        provider.filter.language = null;
      } else {
        provider.filter.language = selected;
      }
      loadBounties();
    }),

    vscode.commands.registerCommand('solfoundry.clearFilter', () => {
      provider.filter = { tier: null, language: null };
      loadBounties();
    }),
  ];

  cmds.forEach(cmd => context.subscriptions.push(cmd));
  context.subscriptions.push(treeView);

  // Auto-load on activation
  loadBounties();

  // Auto-refresh every 5 minutes
  const interval = setInterval(loadBounties, 5 * 60 * 1000);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

function deactivate() {}

module.exports = { activate, deactivate };
