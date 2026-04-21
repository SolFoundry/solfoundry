import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#8A92B2',
  Python: '#3572A5',
  Go: '#00ADD8',
  React: '#61DAFB',
};

export function formatCurrency(amount: number, token: RewardToken | string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: token === 'USDC' ? 2 : 0,
  }).format(amount);

  return token === 'USDC' ? `$${formatted}` : `${formatted} ${token}`;
}

export function timeAgo(value: string | number | Date): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function timeLeft(value: string | number | Date): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'Ended';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return '<1h left';
}
