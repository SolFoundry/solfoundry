import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solidity: '#627eea',
  Python: '#3776ab',
  Go: '#00add8',
  React: '#61dafb',
  TS: '#3178c6',
};

export function formatCurrency(amount: number, token: RewardToken = 'FNDRY'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);

  return token === 'USDC' ? `$${formatted}` : `${formatted} ${token}`;
}

export function timeAgo(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const deltaSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (!Number.isFinite(deltaSeconds)) return 'Unknown';
  if (deltaSeconds < 60) return 'Just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  for (const [unit, secondsPerUnit] of units) {
    const valueInUnit = Math.floor(deltaSeconds / secondsPerUnit);
    if (valueInUnit >= 1) return formatter.format(-valueInUnit, unit);
  }

  return 'Just now';
}

export function timeLeft(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const deltaSeconds = Math.floor((date.getTime() - Date.now()) / 1000);

  if (!Number.isFinite(deltaSeconds)) return 'Unknown';
  if (deltaSeconds <= 0) return 'Expired';

  const days = Math.floor(deltaSeconds / 86_400);
  if (days >= 1) return `${days}d left`;

  const hours = Math.floor(deltaSeconds / 3_600);
  if (hours >= 1) return `${hours}h left`;

  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes >= 1) return `${minutes}m left`;

  return 'Less than 1m';
}
