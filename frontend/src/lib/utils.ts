import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solidity: '#627eea',
  Python: '#3776ab',
  Go: '#00add8',
  React: '#61dafb',
  CSS: '#38bdf8',
};

export function formatCurrency(amount: number, token: RewardToken | string = 'USDC') {
  const normalized = Number.isFinite(amount) ? amount : 0;
  if (token === 'USDC') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: normalized % 1 === 0 ? 0 : 2,
    }).format(normalized);
  }
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(normalized)} ${token}`;
}

export function timeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'recently';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, seconds] of units) {
    const valueForUnit = Math.floor(diffSeconds / seconds);
    if (valueForUnit >= 1) return formatter.format(-valueForUnit, unit);
  }
  return 'just now';
}

export function timeLeft(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'No deadline';

  const diffSeconds = Math.floor((timestamp - Date.now()) / 1000);
  if (diffSeconds <= 0) return 'Ended';

  const days = Math.floor(diffSeconds / 86400);
  if (days >= 1) return `${days}d left`;

  const hours = Math.floor(diffSeconds / 3600);
  if (hours >= 1) return `${hours}h left`;

  const minutes = Math.max(1, Math.floor(diffSeconds / 60));
  return `${minutes}m left`;
}
