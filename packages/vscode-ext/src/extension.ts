import * as vscode from 'vscode';
import * as https from 'https';

export function activate(context: vscode.ExtensionContext) {
  console.log('SolFoundry extension activated');
  
  const provider = new BountyProvider();
  vscode.window.registerTreeDataProvider('solfoundryBounties', provider);
  
  let openPanel = vscode.commands.registerCommand('solfoundry.openPanel', () => {
    const panel = vscode.window.createWebviewPanel(
      'solfoundry',
      'SolFoundry Bounties',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );
    panel.webview.html = getWebviewContent();
  });
  
  let refresh = vscode.commands.registerCommand('solfoundry.refresh', () => {
    provider.refresh();
    vscode.window.showInformationMessage('SolFoundry bounties refreshed');
  });
  
  context.subscriptions.push(openPanel, refresh);
}

class BountyProvider implements vscode.TreeDataProvider<BountyItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<BountyItem | undefined | null | void> = new vscode.EventEmitter<BountyItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<BountyItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: BountyItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<BountyItem[]> {
    return Promise.resolve([
      new BountyItem('Tier 3 Bounties', vscode.TreeItemCollapsibleState.Expanded, 'tier3'),
      new BountyItem('Tier 2 Bounties', vscode.TreeItemCollapsibleState.Expanded, 'tier2'),
      new BountyItem('Tier 1 Bounties', vscode.TreeItemCollapsibleState.Expanded, 'tier1')
    ]);
  }
}

class BountyItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly tier?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = `${label} - Click to view`;
    this.description = tier;
  }
}

function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SolFoundry Bounties</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
    h1 { color: #4ec9b0; }
    .bounty { background: #252526; padding: 15px; margin: 10px 0; border-radius: 5px; }
    .reward { color: #b5cea8; font-weight: bold; }
  </style>
</head>
<body>
  <h1>SolFoundry Bounties</h1>
  <p>Browse available bounties and start earning!</p>
  <div class="bounty">
    <h3>AI Code Review GitHub App</h3>
    <p class="reward">Reward: Tier 3 ($150-300)</p>
    <p>Build an installable GitHub App for AI code review</p>
  </div>
  <div class="bounty">
    <h3>TypeScript SDK</h3>
    <p class="reward">Reward: Tier 3 ($150-300)</p>
    <p>Complete TypeScript SDK for SolFoundry API</p>
  </div>
  <p>Visit <a href="https://sol.foundry">sol.foundry</a> for more bounties</p>
</body>
</html>`;
}

export function deactivate() {}