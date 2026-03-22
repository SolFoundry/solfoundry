import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'sf_admin_token';
const REFRESH_TOKEN_KEY = 'sf_admin_refresh';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  rewardToken: string;
  status: 'open' | 'in_progress' | 'review' | 'completed' | 'closed';
  tier: 1 | 2 | 3;
  issueNumber: number;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  tags: string[];
}

export interface Contributor {
  address: string;
  githubHandle: string;
  reputationScore: number;
  bountiesCompleted: number;
  totalEarned: number;
  status: 'active' | 'pending' | 'banned';
  joinedAt: string;
  lastActiveAt: string;
}

export interface TreasuryStats {
  balance: number;
  totalPaidOut: number;
  pendingPayouts: number;
  reservedForBounties: number;
  tokenMint: string;
}

export interface DashboardStats {
  totalBounties: number;
  openBounties: number;
  completedBounties: number;
  activeContributors: number;
  totalContributors: number;
  treasury: TreasuryStats;
}

export interface ActivityEvent {
  id: string;
  type: 'bounty_created' | 'bounty_completed' | 'contributor_joined' | 'payout_sent' | 'bounty_closed';
  description: string;
  actor?: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BountyFilter {
  status?: Bounty['status'];
  tier?: Bounty['tier'];
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ContributorFilter {
  status?: Contributor['status'];
  search?: string;
  minReputation?: number;
  page?: number;
  pageSize?: number;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setTokens(token: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/admin`,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — attach bearer token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 with token refresh
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post<AuthResponse>(`${BASE_URL}/api/admin/auth/refresh`, {
          refreshToken,
        });

        setTokens(data.token, data.refreshToken);
        refreshQueue.forEach((cb) => cb(data.token));
        refreshQueue = [];

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>)['Authorization'] = `Bearer ${data.token}`;
        }
        return api(originalRequest);
      } catch {
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const auth = {
  async login(password: string): Promise<void> {
    const { data } = await api.post<AuthResponse>('/auth/login', { password });
    setTokens(data.token, data.refreshToken);
  },

  logout(): void {
    clearTokens();
  },

  isAuthenticated(): boolean {
    return !!getToken();
  },
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const dashboard = {
  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get<DashboardStats>('/stats');
    return data;
  },

  async getActivity(limit = 20): Promise<ActivityEvent[]> {
    const { data } = await api.get<ActivityEvent[]>('/activity', { params: { limit } });
    return data;
  },
};

// ─── Bounties ────────────────────────────────────────────────────────────────

export const bounties = {
  async list(filter: BountyFilter = {}): Promise<PaginatedResponse<Bounty>> {
    const { data } = await api.get<PaginatedResponse<Bounty>>('/bounties', { params: filter });
    return data;
  },

  async get(id: string): Promise<Bounty> {
    const { data } = await api.get<Bounty>(`/bounties/${id}`);
    return data;
  },

  async create(payload: Partial<Bounty>): Promise<Bounty> {
    const { data } = await api.post<Bounty>('/bounties', payload);
    return data;
  },

  async update(id: string, payload: Partial<Bounty>): Promise<Bounty> {
    const { data } = await api.patch<Bounty>(`/bounties/${id}`, payload);
    return data;
  },

  async close(id: string, reason: string): Promise<void> {
    await api.post(`/bounties/${id}/close`, { reason });
  },

  async approve(id: string): Promise<void> {
    await api.post(`/bounties/${id}/approve`);
  },
};

// ─── Contributors ─────────────────────────────────────────────────────────────

export const contributors = {
  async list(filter: ContributorFilter = {}): Promise<PaginatedResponse<Contributor>> {
    const { data } = await api.get<PaginatedResponse<Contributor>>('/contributors', { params: filter });
    return data;
  },

  async get(address: string): Promise<Contributor> {
    const { data } = await api.get<Contributor>(`/contributors/${address}`);
    return data;
  },

  async approve(address: string): Promise<void> {
    await api.post(`/contributors/${address}/approve`);
  },

  async ban(address: string, reason: string): Promise<void> {
    await api.post(`/contributors/${address}/ban`, { reason });
  },

  async updateReputation(address: string, delta: number, reason: string): Promise<void> {
    await api.post(`/contributors/${address}/reputation`, { delta, reason });
  },

  async getHistory(address: string): Promise<ActivityEvent[]> {
    const { data } = await api.get<ActivityEvent[]>(`/contributors/${address}/history`);
    return data;
  },
};

// ─── Treasury ─────────────────────────────────────────────────────────────────

export const treasury = {
  async getStats(): Promise<TreasuryStats> {
    const { data } = await api.get<TreasuryStats>('/treasury');
    return data;
  },

  async triggerPayout(contributorAddress: string, amount: number, bountyId: string): Promise<string> {
    const { data } = await api.post<{ txSignature: string }>('/treasury/payout', {
      contributorAddress,
      amount,
      bountyId,
    });
    return data.txSignature;
  },
};

export default api;
