import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Solidity: '#aa6746',
  Python: '#3572A5',
  Go: '#00ADD8',
  React: '#61dafb',
};

export function formatCurrency(amount: number, token: RewardToken | string = 'FNDRY') {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);

  return `${formattedAmount} ${token}`;
}

export function timeAgo(value: string | Date) {
  const timestamp = new Date(value).getTime();
  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const intervals = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ] as const;

  for (const [unit, seconds] of intervals) {
    const count = Math.floor(diffSeconds / seconds);
    if (count >= 1) return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
  }

  return 'just now';
}

export function timeLeft(value: string | Date) {
  const timestamp = new Date(value).getTime();
  const diffMs = timestamp - Date.now();
  if (diffMs <= 0) return 'Expired';

  const diffDays = Math.ceil(diffMs / 86400000);
  if (diffDays >= 1) return `${diffDays}d left`;

  const diffHours = Math.ceil(diffMs / 3600000);
  return `${diffHours}h left`;
}
