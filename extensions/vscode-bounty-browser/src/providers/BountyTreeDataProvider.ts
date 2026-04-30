/**
 * Tree Data Provider for the SolFoundry Bounty Explorer sidebar view.
 * Displays bounties as tree items with search/filter support.
 */

import * as vscode from 'vscode';
import { listBounties, type SolFoundryApiConfig } from '../api/bounties';
import type { Bounty, BountyStatus, BountyTier } from '../types/bounty';

/**
 * Tree item representing a bounty in the explorer sidebar.
 */
export class BountyTreeItem extends vscode.TreeItem {
  constructor(public readonly bounty: Bounty) {
    super(bounty.title, vscode.TreeItemCollapsibleState.None);

    // Tooltip with full description
    this.tooltip = this.buildTooltip(bounty);

    // Description line showing org/repo and reward
    this.description = this.buildDescription(bounty);

    // Context value for context menu commands
    this.contextValue = 'bounty';

    // Command to show detail view on click
    this.command = {
      command: 'solfoundryBounty.showDetail',
      title: 'Show Bounty Detail',
      arguments: [bounty],
    };

    // Icon based on tier
    this.iconPath = this.getTierIcon(bounty.tier);
  }

  private buildTooltip(bounty: Bounty): vscode.MarkdownString {
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;

    md.appendMarkdown(`## ${bounty.title}\n\n`);
    md.appendMarkdown(`**Tier:** ${bounty.tier} | **Status:** ${bounty.status}\n\n`);
    md.appendMarkdown(`**Reward:** ${bounty.reward_amount} ${bounty.reward_token}\n\n`);

    if (bounty.skills?.length) {
      md.appendMarkdown(`**Skills:** ${bounty.skills.join(', ')}\n\n`);
    }

    if (bounty.org_name && bounty.repo_name) {
      md.appendMarkdown(`**Repo:** ${bounty.org_name}/${bounty.repo_name}`);
      if (bounty.issue_number) {
        md.appendMarkdown(` #${bounty.issue_number}`);
      }
      md.appendMarkdown('\n\n');
    }

    if (bounty.description) {
      const truncated = bounty.description.length > 300
        ? bounty.description.substring(0, 300) + '...'
        : bounty.description;
      md.appendMarkdown(`${truncated}\n\n`);
    }

    md.appendMarkdown(`---\n*${bounty.submission_count} submissions*`);

    if (bounty.deadline) {
      const deadline = new Date(bounty.deadline);
      md.appendMarkdown(`\n*Deadline: ${deadline.toLocaleDateString()}*`);
    }

    return md;
  }

  private buildDescription(bounty: Bounty): string {
    const parts: string[] = [];
    if (bounty.org_name && bounty.repo_name) {
      parts.push(`${bounty.org_name}/${bounty.repo_name}`);
    }
    parts.push(`${bounty.reward_amount} ${bounty.reward_token}`);
    return parts.join(' • ');
  }

  private getTierIcon(tier: BountyTier): vscode.ThemeIcon {
    switch (tier) {
      case 'T1': return new vscode.ThemeIcon('star', new vscode.ThemeColor('charts.yellow'));
      case 'T2': return new vscode.ThemeIcon('star', new vscode.ThemeColor('charts.blue'));
      case 'T3': return new vscode.ThemeIcon('star', new vscode.ThemeColor('charts.red'));
    }
  }
}

/**
 * Loading placeholder tree item.
 */
export class LoadingTreeItem extends vscode.TreeItem {
  constructor() {
    super('Loading bounties...', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('loading~spin');
  }
}

/**
 * Error placeholder tree item.
 */
export class ErrorTreeItem extends vscode.TreeItem {
  constructor(message: string, onRetry?: () => void) {
    super('Failed to load bounties', vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('warning');
    this.tooltip = message;

    if (onRetry) {
      this.command = {
        command: 'solfoundryBounty.refresh',
        title: 'Retry',
      };
    }
  }
}

/**
 * Empty state tree item.
 */
export class EmptyTreeItem extends vscode.TreeItem {
  constructor(message = 'No bounties match your filters.') {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon('info');
  }
}

export interface FilterOptions {
  status?: BountyStatus | 'all';
  tier?: BountyTier;
  skill?: string;
  searchQuery?: string;
}

/**
 * Tree Data Provider that fetches and displays bounties.
 */
export class BountyTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private bounties: Bounty[] = [];
  private isLoading = false;
  private error: string | null = null;
  private filter: FilterOptions = {};

  constructor(private config: SolFoundryApiConfig) {}

  /**
   * Update the API configuration (e.g., after user changes settings).
   */
  updateConfig(config: SolFoundryApiConfig): void {
    this.config = config;
    this.refresh();
  }

  /**
   * Update filter options and refresh the tree.
   */
  setFilter(filter: FilterOptions): void {
    this.filter = filter;
    this.refresh();
  }

  /**
   * Get the current filter options.
   */
  getFilter(): FilterOptions {
    return { ...this.filter };
  }

  /**
   * Refresh the bounty list from the API.
   */
  async refresh(): Promise<void> {
    this.isLoading = true;
    this.error = null;
    this._onDidChangeTreeData.fire();

    try {
      const params: Record<string, string | number | undefined> = {
        limit: 50,
      };

      if (this.filter.status && this.filter.status !== 'all') {
        params.status = this.filter.status;
      }
      if (this.filter.tier) {
        params.tier = this.filter.tier;
      }
      if (this.filter.skill) {
        params.skill = this.filter.skill;
      }

      const response = await listBounties(this.config, params as any);
      this.bounties = response.items;

      // Apply client-side search filter
      if (this.filter.searchQuery) {
        const query = this.filter.searchQuery.toLowerCase();
        this.bounties = this.bounties.filter((b) =>
          b.title.toLowerCase().includes(query) ||
          b.description.toLowerCase().includes(query) ||
          b.skills.some((s) => s.toLowerCase().includes(query)) ||
          (b.org_name?.toLowerCase().includes(query) ?? false) ||
          (b.repo_name?.toLowerCase().includes(query) ?? false)
        );
      }
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Unknown error';
      this.bounties = [];
    } finally {
      this.isLoading = false;
      this._onDidChangeTreeData.fire();
    }
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    // Root level only - no children for individual bounties
    if (element) {
      return [];
    }

    if (this.isLoading) {
      return [new LoadingTreeItem()];
    }

    if (this.error) {
      return [new ErrorTreeItem(this.error, () => this.refresh())];
    }

    if (this.bounties.length === 0) {
      return [new EmptyTreeItem()];
    }

    return this.bounties.map((bounty) => new BountyTreeItem(bounty));
  }

  /**
   * Get the currently loaded bounties (for use by other components).
   */
  getBounties(): Bounty[] {
    return this.bounties;
  }

  /**
   * Find a bounty by ID.
   */
  findBounty(id: string): Bounty | undefined {
    return this.bounties.find((b) => b.id === id);
  }
}
