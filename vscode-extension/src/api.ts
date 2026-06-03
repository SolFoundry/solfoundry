// SolFoundry API client

import * as vscode from 'vscode';
import { Bounty, BountyFilter, ClaimResult, ApiConfig } from './types';

function getConfig(): ApiConfig {
  const cfg = vscode.workspace.getConfiguration('solfoundry');
  return {
    baseUrl: cfg.get<string>('apiBaseUrl') || 'https://api.solfoundry.org',
    walletAddress: cfg.get<string>('walletAddress') || undefined,
  };
}

export async function fetchBounties(filter?: BountyFilter): Promise<Bounty[]> {
  const { baseUrl } = getConfig();
  const params = new URLSearchParams();

  if (filter?.language) params.set('language', filter.language);
  if (filter?.tier) params.set('tier', filter.tier);
  if (filter?.minReward) params.set('minReward', String(filter.minReward));

  const url = `${baseUrl}/api/bounties?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`API returned ${res.status}: ${await res.text()}`);
    }
    const data: unknown = await res.json();
    return normalizeBounties(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`SolFoundry API error: ${msg}`);
    vscode.window.showErrorMessage(`SolFoundry API: ${msg}`);
    return [];
  }
}

export async function claimBounty(bountyId: string): Promise<ClaimResult> {
  const { baseUrl, walletAddress } = getConfig();

  try {
    const res = await fetch(`${baseUrl}/api/bounties/${bountyId}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ walletAddress }),
    });
    const data = await res.json() as Record<string, any>;
    return {
      success: res.ok,
      message: data.message || 'Bounty claimed successfully',
      claimUrl: data.claimUrl || data.url,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Claim failed: ${msg}`,
    };
  }
}

function normalizeBounties(raw: any): Bounty[] {
  const items = Array.isArray(raw) ? raw : raw?.data || raw?.bounties || [];

  return items.map((item: any, idx: number) => ({
    id: item.id || item._id || item.number?.toString() || String(idx),
    number: item.number || item.issueNumber || idx,
    title: item.title || 'Untitled',
    body: item.body || item.description || '',
    url: item.url || item.html_url || item.htmlUrl || '',
    state: item.state || 'open',
    reward: item.reward || item.rewardAmount || item.amount || 0,
    rewardToken: item.rewardToken || item.token || 'FNDRY',
    tier: item.tier || item.difficulty || '',
    language: item.language || item.lang || undefined,
    labels: (item.labels || []).map((l: any) => ({
      name: typeof l === 'string' ? l : l.name || l.label || '',
      color: typeof l === 'string' ? undefined : l.color,
    })),
    repo: item.repo || item.repository || '',
    createdAt: item.createdAt || item.created_at || '',
    updatedAt: item.updatedAt || item.updated_at || '',
    claimedBy: item.claimedBy || undefined,
  }));
}
