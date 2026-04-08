/**
 * Bounty analytics API (FastAPI seed data; proxied via Vite `/api`).
 * @module api/analytics
 */

export interface BountyVolumePoint {
  date: string;
  count: number;
}

export interface PayoutPoint {
  date: string;
  amountUsd: number;
}

export interface WeeklyGrowth {
  week_start: string;
  new_contributors: number;
}

export interface ContributorAnalytics {
  new_contributors_last_30d: number;
  active_contributors_last_30d: number;
  retention_rate: number;
  weekly_growth: WeeklyGrowth[];
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Analytics request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getBountyVolume(): Promise<BountyVolumePoint[]> {
  const res = await fetch('/api/analytics/bounty-volume');
  return parseJson(res);
}

export async function getPayouts(): Promise<PayoutPoint[]> {
  const res = await fetch('/api/analytics/payouts');
  return parseJson(res);
}

export async function getContributorAnalytics(): Promise<ContributorAnalytics> {
  const res = await fetch('/api/analytics/contributors');
  return parseJson(res);
}

export const ANALYTICS_EXPORT = {
  csv: '/api/analytics/reports/export.csv',
  pdf: '/api/analytics/reports/export.pdf',
} as const;
