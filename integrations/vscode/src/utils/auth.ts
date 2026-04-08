import * as vscode from 'vscode';
import type { BountyFilters } from '../types';

const SECRET_KEY = 'solfoundry.apiKey';

export class AuthManager {
  constructor(private context: vscode.ExtensionContext) {}

  async getApiKey(): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_KEY);
  }

  async setApiKey(key: string): Promise<void> {
    await this.context.secrets.store(SECRET_KEY, key);
    vscode.window.showInformationMessage('SolFoundry API key saved.');
  }

  async deleteApiKey(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
  }

  async promptForApiKey(): Promise<string | undefined> {
    const key = await vscode.window.showInputBox({
      prompt: 'Enter your SolFoundry API key',
      placeHolder: 'sf_...',
      password: true,
      ignoreFocusOut: true,
    });
    if (key) {
      await this.setApiKey(key);
      return key;
    }
    return undefined;
  }

  getAuthHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }
}

export function getApiBaseUrl(): string {
  const config = vscode.workspace.getConfiguration('solfoundry');
  return config.get<string>('apiUrl', 'https://solfoundry.vercel.app');
}

export function buildQueryString(filters: BountyFilters): string {
  const params = new URLSearchParams();
  if (filters.tier?.length) {
    filters.tier.forEach(t => params.append('tier', t));
  }
  if (filters.status?.length) {
    filters.status.forEach(s => params.append('status', s));
  }
  if (filters.rewardToken?.length) {
    filters.rewardToken.forEach(r => params.append('rewardToken', r));
  }
  if (filters.skill) {
    params.set('skill', filters.skill);
  }
  if (filters.keyword) {
    params.set('q', filters.keyword);
  }
  if (filters.page) {
    params.set('page', String(filters.page));
  }
  if (filters.limit) {
    params.set('limit', String(filters.limit));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
