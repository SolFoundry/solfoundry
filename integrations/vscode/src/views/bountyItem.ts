import * as vscode from 'vscode';
import type { Bounty } from '../types';

export class BountyItem extends vscode.TreeItem {
  constructor(
    public readonly bounty: Bounty,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(bounty.title, collapsibleState);

    const tier = bounty.tier ?? 'T3';
    const reward = bounty.reward ?? '0';

    // Icon by tier
    this.iconPath = this.getTierIcon(tier);

    // Description: reward + status
    this.description = `${reward} ${bounty.rewardToken ?? ''}`.trim();

    // Tooltip
    this.tooltip = new vscode.MarkdownString(
      [
        `**${bounty.title}**`,
        `Tier: ${tier} | Status: ${bounty.status}`,
        `Reward: ${reward} ${bounty.rewardToken ?? ''}`,
        bounty.skills?.length ? `Skills: ${bounty.skills.join(', ')}` : '',
        bounty.language ? `Language: ${bounty.language}` : '',
        bounty.deadline ? `Deadline: ${new Date(bounty.deadline).toLocaleDateString()}` : '',
        `Submissions: ${bounty.submissionsCount ?? 0}`,
        '',
        bounty.description ? bounty.description.substring(0, 300) : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    );

    // Context value for menu when clauses
    this.contextValue = `bounty-${bounty.status}`;

    // Command: click to open details
    this.command = {
      command: 'solfoundry.openInBrowser',
      title: 'Open in Browser',
      arguments: [this],
    };
  }

  private getTierIcon(tier: string): vscode.ThemeIcon {
    switch (tier) {
      case 'T1':
        return new vscode.ThemeIcon('star-filled', new vscode.ThemeColor('charts.yellow'));
      case 'T2':
        return new vscode.ThemeIcon('star-half', new vscode.ThemeColor('charts.blue'));
      case 'T3':
      default:
        return new vscode.ThemeIcon('star', new vscode.ThemeColor('charts.green'));
    }
  }
}

export class DetailItem extends vscode.TreeItem {
  constructor(label: string, value: string) {
    super(`${label}: ${value}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'detail';
  }
}
