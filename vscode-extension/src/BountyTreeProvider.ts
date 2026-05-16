import * as vscode from 'vscode';
import { Bounty, BountySearchParams, FilterState } from './types';
import { listBounties, searchBounties, filterBounties, PROGRAMMING_LANGUAGES, TIERS, STATUSES } from './api';

export class BountyTreeItem extends vscode.TreeItem {
  constructor(
    public readonly bounty: Bounty,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(bounty.title, collapsibleState);

    // Set icon based on tier
    const tierIcons: Record<string, string> = {
      'T1': '$(rocket)',
      'T2': '$(star)',
      'T3': '$(star-half)',
    };
    const tierColors: Record<string, string> = {
      'T1': '#e5c07b',
      'T2': '#61afef',
      'T3': '#c678dd',
    };

    // Status icon
    const statusIcons: Record<string, string> = {
      'open': '$(circle-outline)',
      'in_review': '$(loading~spin)',
      'completed': '$(check-circle)',
      'cancelled': '$(x-circle)',
      'funded': '$(credit-card)',
    };

    const tierIcon = tierIcons[bounty.tier] || '$(circle)';
    const statusIcon = statusIcons[bounty.status] || '$(circle)';
    const rewardLabel = `${bounty.reward_amount} ${bounty.reward_token}`;

    // Build tooltip
    this.tooltip = [
      `${tierIcon} ${bounty.tier} | ${statusIcon} ${bounty.status}`,
      `${rewardLabel}`,
      bounty.github_issue_url ? `[GitHub Issue](${bounty.github_issue_url})` : '',
      bounty.skills.length ? `Skills: ${bounty.skills.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    // Build description
    this.description = `${rewardLabel} | ${bounty.status}`;
    
    // Set icon color via resourceUri (for themes)
    this.iconPath = new vscode.ThemeIcon(
      bounty.status === 'open' ? 'circle-outline' : 
      bounty.status === 'completed' ? 'check-circle' : 'circle'
    );

    // Context value for context menus
    this.contextValue = 'bounty';
    
    // Command to execute when clicked
    this.command = {
      command: 'solfoundry.openBounty',
      title: 'Open Bounty Actions',
      arguments: [bounty],
    };
  }
}

export class BountyFilterItem extends vscode.TreeItem {
  constructor(
    public readonly filterType: 'language' | 'tier' | 'status' | 'reward',
    public readonly value: string,
    public readonly label: string,
    public readonly isActive: boolean = false
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'filter';
    
    if (filterType === 'language') {
      this.iconPath = new vscode.ThemeIcon('code');
    } else if (filterType === 'tier') {
      this.iconPath = new vscode.ThemeIcon('star');
    } else if (filterType === 'status') {
      this.iconPath = new vscode.ThemeIcon('circle-outline');
    } else if (filterType === 'reward') {
      this.iconPath = new vscode.ThemeIcon('credit-card');
    }

    if (isActive) {
      this.label = `✓ ${label}`;
      this.iconPath = new vscode.ThemeIcon('pass-filled');
    }
  }
}

export class FilterHeaderItem extends vscode.TreeItem {
  constructor(
    public readonly filterType: 'language' | 'tier' | 'status',
    public readonly label: string,
    public readonly children: BountyFilterItem[]
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'filterGroup';
    this.iconPath = new vscode.ThemeIcon('filter');
  }
}

export class BountyTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private bounties: Bounty[] = [];
  private allBounties: Bounty[] = [];
  private filters: FilterState = {
    language: 'all',
    rewardMin: 0,
    rewardMax: 0,
    tier: 'all',
    status: 'open', // Default to open bounties
  };
  private searchQuery: string = '';
  private isLoading: boolean = false;
  private errorMessage: string | null = null;

  constructor() {
    this.loadBounties();
  }

  refresh(): void {
    this.loadBounties();
  }

  search(query: string): void {
    this.searchQuery = query;
    this.applyFilters();
  }

  setFilter<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    this.filters[key] = value;
    this.applyFilters();
  }

  private async loadBounties(): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    this._onDidChangeTreeData.fire();

    try {
      const response = await listBounties({ status: 'open', limit: 100 });
      this.allBounties = response.items || [];
      this.applyFilters();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load bounties';
      vscode.window.showWarningMessage(`SolFoundry: ${this.errorMessage}`);
    } finally {
      this.isLoading = false;
      this._onDidChangeTreeData.fire();
    }
  }

  private applyFilters(): void {
    let filtered = [...this.allBounties];

    // Apply search query
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q) ||
          b.skills.some((s) => s.toLowerCase().includes(q))
      );
    }

    // Apply filters
    filtered = filterBounties(filtered, this.filters);

    this.bounties = filtered;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (this.isLoading) {
      return [new LoadingTreeItem()];
    }

    if (this.errorMessage) {
      return [new ErrorTreeItem(this.errorMessage)];
    }

    if (!element) {
      // Root level: show filters + bounties
      const filterItems = this.buildFilterTree();
      const bountyItems = this.bounties.map((b) => new BountyTreeItem(b));
      return [...filterItems, ...bountyItems];
    }

    if (element instanceof FilterHeaderItem) {
      return element.children;
    }

    return [];
  }

  private buildFilterTree(): vscode.TreeItem[] {
    const items: vscode.TreeItem[] = [];

    // Language filters
    const langFilters = PROGRAMMING_LANGUAGES.map(
      (lang) =>
        new BountyFilterItem(
          'language',
          lang,
          lang === 'all' ? '🌐 All Languages' : `🌐 ${lang}`,
          this.filters.language === lang
        )
    );
    items.push(new FilterHeaderItem('language', '🔍 Language', langFilters));

    // Tier filters
    const tierFilters = TIERS.map(
      (tier) =>
        new BountyFilterItem(
          'tier',
          tier,
          tier === 'all' ? '⭐ All Tiers' : `⭐ ${tier}`,
          this.filters.tier === tier
        )
    );
    items.push(new FilterHeaderItem('tier', '⭐ Tier', tierFilters));

    // Status filters
    const statusFilters = STATUSES.map(
      (status) =>
        new BountyFilterItem(
          'status',
          status,
          status === 'all' ? '⭕ All Statuses' : `⭕ ${status}`,
          this.filters.status === status
        )
    );
    items.push(new FilterHeaderItem('status', '⭕ Status', statusFilters));

    // Bounty count header
    const countItem = new vscode.TreeItem(`📋 ${this.bounties.length} bounty(s) found`);
    countItem.contextValue = 'header';
    countItem.iconPath = new vscode.ThemeIcon('list-selection');
    items.push(countItem);

    return items;
  }
}

class LoadingTreeItem extends vscode.TreeItem {
  constructor() {
    super('$(loading~spin) Loading bounties...', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'loading';
  }
}

class ErrorTreeItem extends vscode.TreeItem {
  constructor(message: string) {
    super(`⚠️ ${message}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'error';
    this.iconPath = new vscode.ThemeIcon('error');
  }
}
