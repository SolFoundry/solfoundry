import * as vscode from 'vscode';
import { BountyTreeProvider, BountyTreeItem, BountyFilterItem } from './BountyTreeProvider';
import { Bounty } from './types';

let bountyTreeProvider: BountyTreeProvider;
let treeView: vscode.TreeView<vscode.TreeItem>;

// Command: Refresh bounties
function refreshBounties(): void {
  bountyTreeProvider?.refresh();
}

// Command: Configure API URL
async function configureApiUrl(): Promise<void> {
  const config = vscode.workspace.getConfiguration('solfoundry');
  const currentUrl = config.get<string>('apiUrl') || 'https://solfoundry.xyz';
  
  const newUrl = await vscode.window.showInputBox({
    prompt: 'Enter SolFoundry API base URL',
    value: currentUrl,
    validateInput: (value) => {
      if (!value.startsWith('http')) {
        return 'URL must start with http:// or https://';
      }
      return null;
    }
  });

  if (newUrl !== undefined) {
    await config.update('apiUrl', newUrl, vscode.ConfigurationTarget.Global);
    bountyTreeProvider?.refresh();
    vscode.window.showInformationMessage(`SolFoundry API URL updated to: ${newUrl}`);
  }
}

// Command: Open bounty in browser
function openBountyInBrowser(bounty: Bounty): void {
  const url = bounty.github_issue_url || `https://solfoundry.xyz/bounties/${bounty.id}`;
  vscode.env.openExternal(vscode.Uri.parse(url));
}

// Command: Claim bounty
async function claimBounty(bounty: Bounty): Promise<void> {
  const config = vscode.workspace.getConfiguration('solfoundry');
  const token = config.get<string>('accessToken');
  
  if (!token) {
    const action = await vscode.window.showWarningMessage(
      'SolFoundry access token required to claim bounties. Would you like to configure it now?',
      'Configure', 'Cancel'
    );
    if (action === 'Configure') {
      const newToken = await vscode.window.showInputBox({
        prompt: 'Enter your SolFoundry GitHub OAuth access token',
        password: true,
      });
      if (newToken !== undefined) {
        await config.update('accessToken', newToken, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Token saved. You can now claim bounties.');
      }
    }
    return;
  }

  const confirm = await vscode.window.showInformationMessage(
    `Claim "${bounty.title}" on SolFoundry?`,
    'Open in Browser', 'Cancel'
  );
  
  if (confirm === 'Open in Browser') {
    openBountyInBrowser(bounty);
  }
}

// Command: Search bounties
async function searchBounties(): Promise<void> {
  const query = await vscode.window.showInputBox({
    prompt: 'Search bounties',
    placeHolder: 'Enter search query...',
  });

  if (query !== undefined) {
    bountyTreeProvider.search(query);
  }
}

// Command: Set filter
async function setLanguageFilter(lang: string): Promise<void> {
  bountyTreeProvider.setFilter('language', lang);
}

async function setTierFilter(tier: string): Promise<void> {
  bountyTreeProvider.setFilter('tier', tier);
}

async function setStatusFilter(status: string): Promise<void> {
  bountyTreeProvider.setFilter('status', status);
}

// Command: Open bounty details in a webview panel
function openBountyDetail(bounty: Bounty): void {
  const panel = vscode.window.createWebviewPanel(
    'bountyDetail',
    `Bounty: ${bounty.title}`,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const skillsHtml = bounty.skills.length 
    ? bounty.skills.map(s => `<span class="skill-tag">${s}</span>`).join('')
    : '<span class="no-skills">No skills specified</span>';

  const tierColors: Record<string, string> = { 'T1': '#e5c07b', 'T2': '#61afef', 'T3': '#c678dd' };
  const statusColors: Record<string, string> = {
    'open': '#98c379', 'in_review': '#e5c07b', 'completed': '#61afef', 'cancelled': '#e06c75', 'funded': '#c678dd'
  };

  panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .title { font-size: 18px; font-weight: 600; margin: 0; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .tier-badge { background: ${tierColors[bounty.tier] || '#555'}22; color: ${tierColors[bounty.tier] || '#888'}; border: 1px solid ${tierColors[bounty.tier] || '#555'}44; }
    .status-badge { background: ${statusColors[bounty.status] || '#555'}22; color: ${statusColors[bounty.status] || '#888'}; border: 1px solid ${statusColors[bounty.status] || '#555'}44; }
    .reward { font-size: 24px; font-weight: 700; color: #98c379; margin: 16px 0; }
    .section { margin: 16px 0; }
    .section h3 { font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .description { line-height: 1.6; color: var(--vscode-foreground); }
    .skills { display: flex; flex-wrap: wrap; gap: 6px; }
    .skill-tag { padding: 3px 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 12px; font-size: 12px; }
    .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
    .meta-item { padding: 12px; background: var(--vscode-editorWidget-background); border-radius: 6px; }
    .meta-label { font-size: 11px; color: #888; text-transform: uppercase; }
    .meta-value { font-size: 14px; font-weight: 500; margin-top: 4px; }
    .actions { display: flex; gap: 8px; margin-top: 20px; }
    .btn { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 13px; font-weight: 500; }
    .btn-primary { background: #98c379; color: #1e1e1e; }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .btn:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">${bounty.title}</h1>
    <span class="badge tier-badge">${bounty.tier}</span>
    <span class="badge status-badge">${bounty.status.replace('_', ' ')}</span>
  </div>
  
  <div class="reward">${bounty.reward_amount.toLocaleString()} ${bounty.reward_token}</div>
  
  <div class="section">
    <h3>Description</h3>
    <p class="description">${bounty.description || 'No description provided.'}</p>
  </div>
  
  <div class="section">
    <h3>Skills</h3>
    <div class="skills">${skillsHtml}</div>
  </div>
  
  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Submissions</div>
      <div class="meta-value">${bounty.submission_count}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Created</div>
      <div class="meta-value">${new Date(bounty.created_at).toLocaleDateString()}</div>
    </div>
    ${bounty.github_repo_url ? `<div class="meta-item">
      <div class="meta-label">Repository</div>
      <div class="meta-value">${bounty.org_name}/${bounty.repo_name}</div>
    </div>` : ''}
    ${bounty.github_issue_url ? `<div class="meta-item">
      <div class="meta-label">GitHub Issue</div>
      <div class="meta-value">#${bounty.issue_number}</div>
    </div>` : ''}
  </div>
  
  <div class="actions">
    <button class="btn btn-primary" onclick="openInBrowser()">Claim Bounty</button>
    <button class="btn btn-secondary" onclick="openIssue()">View Issue</button>
  </div>
  
  <script>
    const issueUrl = "${bounty.github_issue_url || ''}";
    const bountyUrl = "https://solfoundry.xyz/bounties/${bounty.id}";
    
    function openInBrowser() {
      window.open(bountyUrl, "_blank");
    }
    function openIssue() {
      if (issueUrl) window.open(issueUrl, "_blank");
    }
  </script>
</body>
</html>`;
}

export function activate(context: vscode.ExtensionContext): void {
  bountyTreeProvider = new BountyTreeProvider();
  
  treeView = vscode.window.createTreeView('solfoundryBounties', {
    treeDataProvider: bountyTreeProvider,
    showCollapseAll: true,
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('solfoundry.refreshBounties', refreshBounties),
    vscode.commands.registerCommand('solfoundry.configureApiUrl', configureApiUrl),
    vscode.commands.registerCommand('solfoundry.openBounty', (bounty: Bounty) => openBountyDetail(bounty)),
    vscode.commands.registerCommand('solfoundry.openBountyInBrowser', (bounty: Bounty) => openBountyInBrowser(bounty)),
    vscode.commands.registerCommand('solfoundry.claimBounty', (bounty: Bounty) => claimBounty(bounty)),
    vscode.commands.registerCommand('solfoundry.searchBounties', searchBounties),
    vscode.commands.registerCommand('solfoundry.setLanguageFilter', (lang: string) => setLanguageFilter(lang)),
    vscode.commands.registerCommand('solfoundry.setTierFilter', (tier: string) => setTierFilter(tier)),
    vscode.commands.registerCommand('solfoundry.setStatusFilter', (status: string) => setStatusFilter(status)),
  );

  // Handle filter item clicks in tree view
  treeView.onDidChangeSelection(async (e) => {
    if (e.selection.length > 0) {
      const item = e.selection[0];
      
      if (item instanceof BountyFilterItem) {
        if (item.filterType === 'language') {
          bountyTreeProvider.setFilter('language', item.value);
        } else if (item.filterType === 'tier') {
          bountyTreeProvider.setFilter('tier', item.value);
        } else if (item.filterType === 'status') {
          bountyTreeProvider.setFilter('status', item.value);
        }
      }
    }
  });

  // Initial load
  bountyTreeProvider.refresh();
}
