import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solidity: '#627eea',
  Python: '#3776ab',
  Go: '#00add8',
  React: '#61dafb',
  SQL: '#f29111',
};

export function formatCurrency(amount: number, token: RewardToken | string = 'FNDRY'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);

  return token === 'USDC' ? `$${formatted}` : `${formatted} ${token}`;
}

export function timeAgo(date: string): string {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 'recently';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60],
    ['month', 30 * 24 * 60 * 60],
    ['week', 7 * 24 * 60 * 60],
    ['day', 24 * 60 * 60],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, secondsPerUnit] of units) {
    if (diffSeconds >= secondsPerUnit) {
      return formatter.format(-Math.floor(diffSeconds / secondsPerUnit), unit);
    }
  }

  return 'just now';
}

export function timeLeft(date: string): string {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return 'No deadline';

  const diffSeconds = Math.floor((timestamp - Date.now()) / 1000);
  if (diffSeconds <= 0) return 'Expired';

  const days = Math.floor(diffSeconds / (24 * 60 * 60));
  if (days > 0) return `${days}d left`;

  const hours = Math.floor(diffSeconds / (60 * 60));
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.floor(diffSeconds / 60);
  return `${Math.max(1, minutes)}m left`;
}
