import * as vscode from 'vscode';
import { BountyProvider } from '../bountyProvider';
import type { BountyTier, BountyStatus, RewardToken } from '../types';

export async function filterBounties(provider: BountyProvider): Promise<void> {
  const options = [
    'Filter by Tier',
    'Filter by Status',
    'Filter by Reward Token',
    'Filter by Skill/Keyword',
  ];

  const pick = await vscode.window.showQuickPick(options, {
    placeHolder: 'Choose filter type',
    ignoreFocusOut: true,
  });
  if (!pick) {
    return;
  }

  const filters = provider.getFilters();

  switch (pick) {
    case 'Filter by Tier': {
      const tiers: BountyTier[] = ['T1', 'T2', 'T3'];
      const selected = await vscode.window.showQuickPick(
        tiers.map(t => ({ label: t, picked: filters.tier?.includes(t) })),
        { canPickMany: true, placeHolder: 'Select tiers', ignoreFocusOut: true }
      );
      if (selected) {
        filters.tier = selected.map(s => s.label as BountyTier);
      }
      break;
    }
    case 'Filter by Status': {
      const statuses: BountyStatus[] = ['open', 'in_progress', 'in_review', 'completed', 'cancelled'];
      const selected = await vscode.window.showQuickPick(
        statuses.map(s => ({ label: s, description: s.replace('_', ' '), picked: filters.status?.includes(s) })),
        { canPickMany: true, placeHolder: 'Select statuses', ignoreFocusOut: true }
      );
      if (selected) {
        filters.status = selected.map(s => s.label as BountyStatus);
      }
      break;
    }
    case 'Filter by Reward Token': {
      const tokens: RewardToken[] = ['USDC', 'FNDRY', 'SOL'];
      const selected = await vscode.window.showQuickPick(
        tokens.map(t => ({ label: t, picked: filters.rewardToken?.includes(t) })),
        { canPickMany: true, placeHolder: 'Select reward tokens', ignoreFocusOut: true }
      );
      if (selected) {
        filters.rewardToken = selected.map(s => s.label as RewardToken);
      }
      break;
    }
    case 'Filter by Skill/Keyword': {
      const keyword = await vscode.window.showInputBox({
        prompt: 'Enter skill or keyword to filter',
        placeHolder: 'e.g. Rust, React, smart contract',
        value: filters.skill ?? filters.keyword ?? '',
        ignoreFocusOut: true,
      });
      if (keyword !== undefined) {
        filters.skill = keyword || undefined;
        filters.keyword = keyword || undefined;
      }
      break;
    }
  }

  provider.setFilters(filters);
}

export async function clearFilters(provider: BountyProvider): Promise<void> {
  provider.clearFilters();
  vscode.window.showInformationMessage('SolFoundry filters cleared.');
}
