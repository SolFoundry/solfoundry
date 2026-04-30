/**
 * Webview panel provider for displaying bounty details and claim submission.
 * Renders an HTML panel inside VS Code with full bounty information
 * and an interactive claim submission form.
 */

import * as vscode from 'vscode';
import type { Bounty, SubmissionCreatePayload } from '../types/bounty';
import {
  getBounty,
  createSubmission,
  getReviewFee,
  type SolFoundryApiConfig,
} from '../api/bounties';

/**
 * Manages a single webview panel for bounty detail display.
 */
export class BountyDetailPanel {
  public static currentPanel: BountyDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private bounty: Bounty | null = null;

  private constructor(
    panel: vscode.WebviewPanel,
    private config: SolFoundryApiConfig
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.onDidChangeViewState(
      () => {
        if (this.panel.visible) {
          this.refresh();
        }
      },
      null,
      this.disposables
    );
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      null,
      this.disposables
    );
  }

  /**
   * Create or show the bounty detail panel for a given bounty.
   */
  public static async createOrShow(
    bounty: Bounty,
    config: SolFoundryApiConfig
  ): Promise<BountyDetailPanel> {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (BountyDetailPanel.currentPanel) {
      BountyDetailPanel.currentPanel.panel.reveal(column);
      BountyDetailPanel.currentPanel.bounty = bounty;
      BountyDetailPanel.currentPanel.config = config;
      BountyDetailPanel.currentPanel.refresh();
      return BountyDetailPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'solfoundryBountyDetail',
      `Bounty: ${bounty.title}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    const instance = new BountyDetailPanel(panel, config);
    instance.bounty = bounty;
    instance.refresh();
    BountyDetailPanel.currentPanel = instance;
    return instance;
  }

  /**
   * Refresh the panel content by fetching latest data from the API.
   */
  private async refresh(): Promise<void> {
    if (!this.bounty) return;

    try {
      // Fetch latest bounty data
      const latest = await getBounty(this.config, this.bounty.id);
      this.bounty = latest;
      this.panel.title = `Bounty: ${latest.title}`;
    } catch {
      // Use cached bounty data if refresh fails
    }

    this.panel.webview.html = this.getHtmlContent(this.bounty);
  }

  /**
   * Handle messages from the webview.
   */
  private async handleMessage(message: Record<string, unknown>): Promise<void> {
    const { type, ...data } = message;

    switch (type) {
      case 'openGithubIssue': {
        if (this.bounty?.github_issue_url) {
          vscode.env.openExternal(vscode.Uri.parse(this.bounty.github_issue_url));
        }
        break;
      }

      case 'openGithubRepo': {
        if (this.bounty?.github_repo_url) {
          vscode.env.openExternal(vscode.Uri.parse(this.bounty.github_repo_url));
        }
        break;
      }

      case 'submitClaim': {
        await this.handleClaimSubmission(data as SubmissionCreatePayload);
        break;
      }

      case 'getReviewFee': {
        if (this.bounty) {
          try {
            const feeInfo = await getReviewFee(this.config, this.bounty.id);
            this.panel.webview.postMessage({
              type: 'reviewFeeInfo',
              data: feeInfo,
            });
          } catch {
            this.panel.webview.postMessage({
              type: 'reviewFeeError',
              data: { error: 'Failed to fetch review fee info' },
            });
          }
        }
        break;
      }

      case 'copyToClipboard': {
        const text = data.text as string;
        if (text) {
          await vscode.env.clipboard.writeText(text);
          vscode.window.showInformationMessage('Copied to clipboard');
        }
        break;
      }

      case 'showError': {
        vscode.window.showErrorMessage(data.message as string);
        break;
      }

      case 'showInfo': {
        vscode.window.showInformationMessage(data.message as string);
        break;
      }
    }
  }

  /**
   * Handle claim submission from the webview.
   */
  private async handleClaimSubmission(payload: SubmissionCreatePayload): Promise<void> {
    if (!this.bounty) {
      this.panel.webview.postMessage({
        type: 'claimResult',
        data: { success: false, error: 'No bounty loaded' },
      });
      return;
    }

    // Validate required fields
    if (!payload.pr_url && !payload.repo_url) {
      this.panel.webview.postMessage({
        type: 'claimResult',
        data: { success: false, error: 'PR URL or Repository URL is required' },
      });
      return;
    }

    try {
      const submission = await createSubmission(this.config, this.bounty.id, payload);
      this.panel.webview.postMessage({
        type: 'claimResult',
        data: { success: true, submission },
      });
      vscode.window.showInformationMessage(
        `Claim submitted for "${this.bounty.title}" successfully!`
      );
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Submission failed';
      this.panel.webview.postMessage({
        type: 'claimResult',
        data: { success: false, error: errorMessage },
      });
    }
  }

  /**
   * Generate the HTML content for the webview panel.
   */
  private getHtmlContent(bounty: Bounty): string {
    const hasRepo = bounty.has_repo ?? !!bounty.github_repo_url;
    const statusLabel = this.getStatusLabel(bounty.status);
    const statusColor = this.getStatusColor(bounty.status);
    const tierColor = this.getTierColor(bounty.tier);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https: data:;">
  <style>
    :root {
      --bg-primary: var(--vscode-editor-background);
      --bg-secondary: var(--vscode-editor-inactiveSelectionBackground);
      --text-primary: var(--vscode-editor-foreground);
      --text-secondary: var(--vscode-descriptionForeground);
      --text-muted: var(--vscode-disabledForeground);
      --border-color: var(--vscode-editorGroup-border);
      --accent: #10b981;
      --accent-hover: #059669;
      --error: #ef4444;
      --warning: #f59e0b;
      --info: #3b82f6;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, sans-serif);
      font-size: var(--vscode-font-size, 14px);
      color: var(--text-primary);
      background: var(--bg-primary);
      padding: 20px;
      line-height: 1.6;
    }

    .container { max-width: 800px; margin: 0 auto; }

    .header { margin-bottom: 24px; }
    .header h1 { font-size: 1.5em; font-weight: 600; margin-bottom: 8px; }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 500;
    }

    .badge-status { background: ${statusColor}20; color: ${statusColor}; }
    .badge-tier { background: ${tierColor}20; color: ${tierColor}; }

    .repo-info {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.85em;
      color: var(--text-secondary);
    }

    .reward-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .reward-amount {
      font-size: 1.8em;
      font-weight: 700;
      color: var(--accent);
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .reward-label {
      font-size: 0.8em;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .section h2 {
      font-size: 1em;
      font-weight: 600;
      margin-bottom: 12px;
      color: var(--text-primary);
    }

    .section p {
      color: var(--text-secondary);
      font-size: 0.9em;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .skills-list {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .skill-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 0.8em;
      background: var(--bg-primary);
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }

    .skill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent);
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .info-label {
      font-size: 0.75em;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .info-value {
      font-size: 0.9em;
      color: var(--text-primary);
      font-family: var(--vscode-editor-font-family, monospace);
    }

    .links {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }

    .link-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.85em;
      color: var(--accent);
      background: transparent;
      border: 1px solid var(--accent);
      cursor: pointer;
      transition: all 0.15s;
    }

    .link-btn:hover {
      background: var(--accent);
      color: var(--bg-primary);
    }

    /* Form styles */
    .form-group { margin-bottom: 16px; }

    .form-label {
      display: block;
      font-size: 0.85em;
      font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .form-input, .form-textarea {
      width: 100%;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
      outline: none;
      transition: border-color 0.15s;
    }

    .form-input:focus, .form-textarea:focus {
      border-color: var(--accent);
    }

    .form-textarea { resize: vertical; min-height: 80px; }

    .form-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .btn-primary {
      padding: 8px 20px;
      border-radius: 6px;
      border: none;
      background: var(--accent);
      color: white;
      font-weight: 600;
      font-size: 0.9em;
      cursor: pointer;
      transition: background 0.15s;
    }

    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-secondary {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--border-color);
      background: var(--bg-primary);
      color: var(--text-secondary);
      font-size: 0.85em;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-secondary:hover {
      border-color: var(--text-secondary);
      color: var(--text-primary);
    }

    .status-message {
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 0.85em;
      margin-top: 12px;
    }

    .status-success {
      background: #10b98120;
      color: #10b981;
      border: 1px solid #10b98140;
    }

    .status-error {
      background: #ef444420;
      color: #ef4444;
      border: 1px solid #ef444440;
    }

    .status-info {
      background: #3b82f620;
      color: #3b82f6;
      border: 1px solid #3b82f640;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--border-color);
      margin: 16px 0;
    }

    .fee-section {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      margin-top: 12px;
    }

    .fee-header {
      font-size: 0.75em;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .fee-amount {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 0.9em;
      color: var(--warning);
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid var(--border-color);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      margin-right: 6px;
      vertical-align: middle;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="meta-row">
        ${bounty.org_name && bounty.repo_name
          ? `<span class="repo-info">${bounty.org_name}/${bounty.repo_name}${bounty.issue_number ? ` #${bounty.issue_number}` : ''}</span>`
          : ''}
        <span class="badge badge-tier">${bounty.tier}</span>
        <span class="badge badge-status">${statusLabel}</span>
      </div>
      <h1>${this.escapeHtml(bounty.title)}</h1>
    </div>

    <!-- Reward -->
    <div class="reward-card">
      <div>
        <div class="reward-label">Reward</div>
        <div class="reward-amount">${bounty.reward_amount.toLocaleString()} ${bounty.reward_token}</div>
      </div>
      <div style="text-align: right;">
        <div class="reward-label">Submissions</div>
        <div class="info-value">${bounty.submission_count}</div>
      </div>
    </div>

    <!-- Skills -->
    ${bounty.skills?.length
      ? `<div class="section">
          <h2>Skills Required</h2>
          <div class="skills-list">
            ${bounty.skills.map((s) => `<span class="skill-tag"><span class="skill-dot"></span>${this.escapeHtml(s)}</span>`).join('')}
          </div>
        </div>`
      : ''}

    <!-- Description -->
    <div class="section">
      <h2>Description</h2>
      <p>${this.escapeHtml(bounty.description)}</p>
    </div>

    <!-- Details Grid -->
    <div class="section">
      <h2>Bounty Details</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Status</span>
          <span class="info-value">${statusLabel}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tier</span>
          <span class="info-value">${bounty.tier}</span>
        </div>
        ${bounty.deadline
          ? `<div class="info-item">
              <span class="info-label">Deadline</span>
              <span class="info-value">${new Date(bounty.deadline).toLocaleDateString()}</span>
            </div>`
          : ''}
        <div class="info-item">
          <span class="info-label">Posted</span>
          <span class="info-value">${new Date(bounty.created_at).toLocaleDateString()}</span>
        </div>
        ${bounty.creator_username
          ? `<div class="info-item">
              <span class="info-label">Creator</span>
              <span class="info-value">${this.escapeHtml(bounty.creator_username)}</span>
            </div>`
          : ''}
      </div>
    </div>

    <!-- Links -->
    ${(bounty.github_issue_url || bounty.github_repo_url)
      ? `<div class="links">
          ${bounty.github_issue_url
            ? `<button class="link-btn" onclick="openGithubIssue()">View GitHub Issue</button>`
            : ''}
          ${bounty.github_repo_url
            ? `<button class="link-btn" onclick="openGithubRepo()">View Repository</button>`
            : ''}
        </div>`
      : ''}

    <hr class="divider">

    <!-- Claim Submission Form -->
    ${bounty.status === 'open' || bounty.status === 'funded'
      ? `<div class="section">
          <h2>Submit Your Claim</h2>
          <form id="claimForm">
            <div class="form-group">
              <label class="form-label">${hasRepo ? 'PR URL' : 'Repository URL'} *</label>
              <input
                type="url"
                id="urlInput"
                class="form-input"
                placeholder="${hasRepo ? 'https://github.com/org/repo/pull/42' : 'https://github.com/username/repo'}"
                required
              />
            </div>
            ${!hasRepo
              ? `<div class="form-group">
                  <label class="form-label">Brief Description</label>
                  <textarea id="descInput" class="form-textarea" placeholder="Describe your implementation..."></textarea>
                </div>`
              : ''}
            <div class="form-group">
              <label class="form-label">Transaction Signature (for review fee)</label>
              <input
                type="text"
                id="txInput"
                class="form-input"
                placeholder="Paste Solana transaction signature..."
              />
            </div>

            <div id="feeSection" class="fee-section" style="display: none;">
              <div class="fee-header">FNDRY Review Fee</div>
              <div class="fee-amount" id="feeAmount">Loading...</div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-primary" id="submitBtn">
                ${hasRepo ? 'Submit PR' : 'Submit Solution'}
              </button>
              <button type="button" class="btn-secondary" id="checkFeeBtn">Check Review Fee</button>
            </div>
            <div id="statusMessage"></div>
          </form>
        </div>`
      : `<div class="section">
          <div class="status-message status-info">
            This bounty is currently <strong>${statusLabel}</strong>. Claims are not accepted.
          </div>
        </div>`}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const bountyId = '${bounty.id}';
    const hasRepo = ${hasRepo};

    // Form submission
    document.getElementById('claimForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const url = document.getElementById('urlInput').value.trim();
      if (!url) return;

      const submitBtn = document.getElementById('submitBtn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Submitting...';

      const payload = {
        ${hasRepo ? 'pr_url: url,' : 'repo_url: url,'}
        ${!hasRepo ? 'description: document.getElementById("descInput").value.trim(),' : ''}
        tx_signature: document.getElementById('txInput').value.trim() || undefined,
      };

      vscode.postMessage({ type: 'submitClaim', ...payload });
    });

    // Check review fee
    document.getElementById('checkFeeBtn').addEventListener('click', () => {
      vscode.postMessage({ type: 'getReviewFee' });
      document.getElementById('feeSection').style.display = 'block';
      document.getElementById('feeAmount').textContent = 'Loading...';
    });

    // Open links
    function openGithubIssue() {
      vscode.postMessage({ type: 'openGithubIssue' });
    }

    function openGithubRepo() {
      vscode.postMessage({ type: 'openGithubRepo' });
    }

    // Handle messages from extension
    window.addEventListener('message', (event) => {
      const msg = event.data;

      if (msg.type === 'claimResult') {
        const submitBtn = document.getElementById('submitBtn');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '${hasRepo ? 'Submit PR' : 'Submit Solution'}';

        const statusDiv = document.getElementById('statusMessage');
        if (msg.data.success) {
          statusDiv.innerHTML = '<div class="status-message status-success">✓ Claim submitted successfully! AI review will begin shortly.</div>';
          document.getElementById('claimForm').reset();
        } else {
          statusDiv.innerHTML = '<div class="status-message status-error">✗ ' + escapeHtml(msg.data.error || 'Submission failed') + '</div>';
        }
      }

      if (msg.type === 'reviewFeeInfo') {
        const feeInfo = msg.data;
        const usdValue = (feeInfo.fndry_amount * feeInfo.fndry_price_usd).toFixed(2);
        document.getElementById('feeAmount').innerHTML =
          feeInfo.fndry_amount.toLocaleString() + ' FNDRY (~$' + usdValue + ')';
      }

      if (msg.type === 'reviewFeeError') {
        document.getElementById('feeAmount').textContent = 'Could not fetch fee info';
      }
    });

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
  }

  /**
   * Dispose the panel and clean up.
   */
  public dispose(): void {
    BountyDetailPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) x.dispose();
    }
  }

  // --- Utility methods ---

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      open: 'Open',
      in_review: 'In Review',
      funded: 'Funded',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status] ?? status;
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      open: '#10b981',
      in_review: '#a855f7',
      funded: '#3b82f6',
      completed: '#6b7280',
      cancelled: '#ef4444',
    };
    return colors[status] ?? '#6b7280';
  }

  private getTierColor(tier: string): string {
    const colors: Record<string, string> = {
      T1: '#eab308',
      T2: '#3b82f6',
      T3: '#ef4444',
    };
    return colors[tier] ?? '#6b7280';
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
