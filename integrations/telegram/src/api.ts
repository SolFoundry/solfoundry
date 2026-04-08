import axios from 'axios';
import { Bounty, ListBountiesParams, ListBountiesResponse, LeaderboardEntry, PlatformStats } from './types';

const API_BASE = process.env.SOLFOUNDRY_API_URL || 'https://solfoundry.io';

const client = axios.create({ baseURL: API_BASE, timeout: 15000 });

export async function listBounties(params?: ListBountiesParams): Promise<ListBountiesResponse> {
  const { data } = await client.get('/api/bounties', { params });
  return data;
}

export async function getBounty(id: string): Promise<Bounty> {
  const { data } = await client.get(`/api/bounties/${id}`);
  return data;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data } = await client.get('/api/leaderboard');
  return data;
}

export async function getStats(): Promise<PlatformStats> {
  const { data } = await client.get('/api/stats');
  return data;
}
