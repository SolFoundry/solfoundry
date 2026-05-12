export const LANG_COLORS: Record<string, string> = {
  typescript: '#3178c6',
  javascript: '#f7df1e',
  rust: '#dea584',
  python: '#3776ab',
  solidity: '#627eea',
  react: '#61dafb',
  nextjs: '#ffffff',
  solana: '#14f195',
};

function toDate(value: string | number | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pluralize(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

export function timeAgo(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return 'recently';

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${pluralize(minutes, 'min')} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${pluralize(hours, 'hour')} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${pluralize(days, 'day')} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${pluralize(months, 'month')} ago`;

  return `${pluralize(Math.floor(months / 12), 'year')} ago`;
}

export function timeLeft(value: string | number | Date): string {
  const date = toDate(value);
  if (!date) return 'No deadline';

  const seconds = Math.floor((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return 'Expired';

  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return pluralize(minutes, 'min');

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return pluralize(hours, 'hour');

  return pluralize(Math.ceil(hours / 24), 'day');
}

export function formatCurrency(amount: number | string, token = 'USDC'): string {
  const numericAmount = Number(amount);
  const displayAmount = Number.isFinite(numericAmount)
    ? new Intl.NumberFormat('en-US', {
        maximumFractionDigits: numericAmount >= 100 ? 0 : 2,
      }).format(numericAmount)
    : String(amount);

  if (token.toUpperCase() === 'USDC' || token.toUpperCase() === 'USD') {
    return `$${displayAmount}`;
  }

  return `${displayAmount} ${token}`;
}
