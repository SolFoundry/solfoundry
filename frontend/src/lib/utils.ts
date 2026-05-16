export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Python: '#3572a5',
  Go: '#00add8',
  Solidity: '#aa6746',
  Svelte: '#ff3e00',
  React: '#61dafb',
  CSS: '#563d7c',
  HTML: '#e34c26',
};

export function formatCurrency(amount?: number | string | null, token = 'USDC') {
  const numericAmount = Number(amount ?? 0);
  const formattedAmount = Number.isFinite(numericAmount)
    ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numericAmount)
    : '0';

  return `${formattedAmount} ${token}`;
}

export function timeAgo(value?: string | number | Date | null) {
  if (!value) {
    return 'recently';
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'recently';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, unitSeconds] of units) {
    if (seconds >= unitSeconds) {
      return rtf.format(-Math.floor(seconds / unitSeconds), unit);
    }
  }

  return 'just now';
}

export function timeLeft(value?: string | number | Date | null) {
  if (!value) {
    return 'No deadline';
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'No deadline';
  }

  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  if (seconds <= 0) {
    return 'Ended';
  }

  const days = Math.ceil(seconds / 86400);
  if (days >= 2) {
    return `${days} days left`;
  }

  const hours = Math.ceil(seconds / 3600);
  if (hours >= 2) {
    return `${hours} hours left`;
  }

  return 'Ending soon';
}
