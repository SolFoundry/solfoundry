import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#AA6746',
  Python: '#3776AB',
  Go: '#00ADD8',
  React: '#61DAFB',
  TS: '#3178C6',
};

export function formatCurrency(amount: number, token: RewardToken = 'FNDRY'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const compact =
    Math.abs(value) >= 1_000_000
      ? `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`
      : Math.abs(value) >= 1_000
        ? `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`
        : value.toLocaleString();
  return `${compact} ${token}`;
}

export function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'just now';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
