import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solidity: '#627eea',
  Python: '#3776ab',
  Go: '#00add8',
  React: '#61dafb',
  Tailwind: '#38bdf8',
};

export function formatCurrency(amount: number, token: RewardToken = 'FNDRY') {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: token === 'USDC' ? 2 : 0,
  }).format(amount);

  return token === 'USDC' ? `$${formattedAmount}` : `${formattedAmount} ${token}`;
}

export function timeAgo(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return 'Just now';

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const [unit, secondsPerUnit] = units.find(([, seconds]) => diffSeconds >= seconds) ?? ['minute', 60];

  return formatter.format(-Math.floor(diffSeconds / secondsPerUnit), unit);
}

export function timeLeft(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Unknown';

  const diffSeconds = Math.floor((timestamp - Date.now()) / 1000);
  if (diffSeconds <= 0) return 'Expired';

  const days = Math.floor(diffSeconds / 86400);
  if (days > 0) return `${days}d left`;

  const hours = Math.floor(diffSeconds / 3600);
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.max(1, Math.floor(diffSeconds / 60));
  return `${minutes}m left`;
}
