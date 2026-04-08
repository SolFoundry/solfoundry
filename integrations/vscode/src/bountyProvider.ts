import * as vscode from 'vscode';
import { ApiClient } from '../api/client';
import { BountyItem, DetailItem } from '../views/bountyItem';
import type { Bounty, BountyFilters } from '../types';

export class BountyProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private bounties: Bounty[] = [];
  private filters: BountyFilters = {};

  constructor(private client: ApiClient) {}

  setFilters(filters: BountyFilters): void {
    this.filters = filters;
    this.refresh();
  }

  getFilters(): BountyFilters {
    return { ...this.filters };
  }

  clearFilters(): void {
    this.filters = {};
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element instanceof BountyItem) {
      return this.getDetailItems(element.bounty);
    }

    try {
      const response = await this.client.listBounties(
        Object.keys(this.filters).length > 0 ? this.filters : undefined
      );
      this.bounties = response.data ?? [];
      return this.bounties.map(
        b => new BountyItem(b, vscode.TreeItemCollapsibleState.Collapsed)
      );
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to load bounties: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }

  private getDetailItems(bounty: Bounty): DetailItem[] {
    const items: DetailItem[] = [];
    items.push(new DetailItem('Tier', bounty.tier ?? 'T3'));
    items.push(new DetailItem('Reward', `${bounty.reward} ${bounty.rewardToken ?? ''}`.trim()));
    items.push(new DetailItem('Status', bounty.status));
    if (bounty.language) {
      items.push(new DetailItem('Language', bounty.language));
    }
    if (bounty.skills?.length) {
      items.push(new DetailItem('Skills', bounty.skills.join(', ')));
    }
    if (bounty.deadline) {
      items.push(new DetailItem('Deadline', new Date(bounty.deadline).toLocaleDateString()));
    }
    items.push(new DetailItem('Assignees', `${bounty.currentAssignees ?? 0}/${bounty.maxAssignees ?? 1}`));
    items.push(new DetailItem('Submissions', String(bounty.submissionsCount ?? 0)));
    if (bounty.githubIssueUrl) {
      items.push(new DetailItem('GitHub', bounty.githubIssueUrl));
    }
    return items;
  }

  getBountyAt(element: vscode.TreeItem): Bounty | undefined {
    if (element instanceof BountyItem) {
      return element.bounty;
    }
    return undefined;
  }

  getTotalOpen(): number {
    return this.bounties.filter(b => b.status === 'open').length;
  }
}
