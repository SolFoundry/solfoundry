export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Solidity: '#363636',
  Java: '#B07219',
  C: '#555555',
  'C++': '#F34B7D',
  Ruby: '#CC342D',
  Swift: '#FA7343',
  Kotlin: '#A97BFF',
  Shell: '#89E051',
};

export function formatCurrency(amount?: number | string | null, token = 'USDC') {
  const numericAmount = Number(amount ?? 0);
  const formattedAmount = Number.isFinite(numericAmount)
    ? numericAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '0';

  if (token.toUpperCase() === 'USDC' || token === '$') {
    return `$${formattedAmount}`;
  }

  return `${formattedAmount} ${token}`;
}

export function timeAgo(value?: string | Date | null) {
  if (!value) return 'recently';

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return 'recently';

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
  ];

  for (const [unit, size] of units) {
    const count = Math.floor(seconds / size);
    if (count >= 1) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-count, unit);
    }
  }

  return 'just now';
}

export function timeLeft(value?: string | Date | null) {
  if (!value) return 'No deadline';

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return 'No deadline';

  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  if (seconds <= 0) return 'Expired';

  const days = Math.floor(seconds / (60 * 60 * 24));
  if (days >= 1) return `${days}d left`;

  const hours = Math.floor(seconds / (60 * 60));
  if (hours >= 1) return `${hours}h left`;

  const minutes = Math.max(1, Math.floor(seconds / 60));
  return `${minutes}m left`;
}
