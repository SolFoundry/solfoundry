import * as vscode from 'vscode';
import { Bounty, BountyFilter } from './types';
import { fetchBounties } from './api';

export class BountiesProvider implements vscode.TreeDataProvider<BountyItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<BountyItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private bounties: Bounty[] = [];
  private currentFilter: BountyFilter = {};

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setFilter(filter: Partial<BountyFilter>): void {
    this.currentFilter = { ...this.currentFilter, ...filter };
    this.refresh();
  }

  clearFilter(): void {
    this.currentFilter = {};
    this.refresh();
  }

  getFilter(): BountyFilter {
    return this.currentFilter;
  }

  getTreeItem(element: BountyItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: BountyItem): Promise<BountyItem[]> {
    if (element) {
      return element.children ?? [];
    }

    this.bounties = await fetchBounties(this.currentFilter);

    if (this.bounties.length === 0) {
      const emptyItem = new vscode.TreeItem(
        'No bounties found',
        vscode.TreeItemCollapsibleState.None
      );
      emptyItem.description = 'Try changing filters or refresh';
      emptyItem.iconPath = new vscode.ThemeIcon('info');
      return [emptyItem as any];
    }

    const grouped = this.groupByLanguage(this.bounties);

    const items: BountyItem[] = [];
    for (const [lang, list] of Object.entries(grouped)) {
      const langGroup = new BountyItem(
        lang || 'Other',
        vscode.TreeItemCollapsibleState.Expanded,
        'language-group',
        undefined,
        list.map((b) => this.createBountyItem(b))
      );
      langGroup.iconPath = new vscode.ThemeIcon('folder-library');
      langGroup.description = `${list.length} bounties`;
      langGroup.tooltip = `${list.length} open bounties in ${lang || 'Other'}`;
      items.push(langGroup);
    }

    return items;
  }

  private createBountyItem(bounty: Bounty): BountyItem {
    const tierIcon = bounty.tier?.toLowerCase().includes('1')
      ? 'star-full'
      : 'star';

    const item = new BountyItem(
      `#${bounty.number}: ${bounty.title}`,
      vscode.TreeItemCollapsibleState.None,
      'bounty'
    );

    item.iconPath = new vscode.ThemeIcon(tierIcon);
    item.description = this.formatReward(bounty);
    item.tooltip = this.buildTooltip(bounty);
    item.command = {
      command: 'solfoundry-bounties.openInBrowser',
      title: 'Open in Browser',
      arguments: [bounty],
    };

    item.bountyData = bounty;

    return item;
  }

  private formatReward(bounty: Bounty): string {
    if (bounty.reward <= 0) return '';
    if (bounty.reward >= 1_000_000) {
      return `${(bounty.reward / 1_000_000).toFixed(1)}M $${bounty.rewardToken}`;
    }
    if (bounty.reward >= 1_000) {
      return `${(bounty.reward / 1_000).toFixed(0)}K $${bounty.rewardToken}`;
    }
    return `${bounty.reward} $${bounty.rewardToken}`;
  }

  private buildTooltip(bounty: Bounty): string {
    const lines = [
      `**#${bounty.number}: ${bounty.title}**`,
      '',
      `Reward: ${this.formatReward(bounty)}`,
      `Tier: ${bounty.tier || 'N/A'}`,
      `State: ${bounty.state}`,
      `Created: ${bounty.createdAt}`,
    ];
    if (bounty.language) {
      lines.splice(2, 0, `Language: ${bounty.language}`);
    }
    if (bounty.labels?.length) {
      const tags = bounty.labels.map((l) => `\`${l.name}\``).join(' ');
      lines.push(`Labels: ${tags}`);
    }
    return new vscode.MarkdownString(lines.join('\n')).value;
  }

  private groupByLanguage(
    bounties: Bounty[]
  ): Record<string, Bounty[]> {
    const groups: Record<string, Bounty[]> = {};
    for (const b of bounties) {
      const key = b.language || b.labels?.find((l) =>
        /python|javascript|typescript|go|rust|swift|solidity/i.test(l.name)
      )?.name || 'Other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(b);
    }
    return Object.fromEntries(
      Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    );
  }
}

export class BountyItem extends vscode.TreeItem {
  children?: BountyItem[];
  bountyData?: Bounty;

  constructor(
    label: string,
    collapsible: vscode.TreeItemCollapsibleState,
    contextValue: string,
    children?: BountyItem[],
    childItems?: BountyItem[]
  ) {
    super(label, collapsible);
    this.contextValue = contextValue;
    if (children) this.children = children;
    if (childItems) this.children = childItems;
  }
}
