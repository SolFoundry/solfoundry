import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3b82f6',
  JavaScript: '#eab308',
  Rust: '#f97316',
  Solidity: '#a855f7',
  Python: '#22c55e',
  Go: '#06b6d4',
  React: '#38bdf8',
  default: '#5C5C78',
};

export function formatCurrency(amount: number, token: RewardToken | string = 'FNDRY'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
  return `${formatted} ${token}`;
}

export function timeAgo(dateLike?: string | null): string {
  if (!dateLike) return 'unknown';
  const timestamp = new Date(dateLike).getTime();
  if (Number.isNaN(timestamp)) return 'unknown';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function timeLeft(dateLike?: string | null): string {
  if (!dateLike) return 'No deadline';
  const timestamp = new Date(dateLike).getTime();
  if (Number.isNaN(timestamp)) return 'No deadline';
  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  if (seconds <= 0) return 'Expired';
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h left`;
  const minutes = Math.max(1, Math.floor(seconds / 60));
  return `${minutes}m left`;
}
