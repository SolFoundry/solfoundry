export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  React: '#61DAFB',
  Rust: '#DEA584',
  Solidity: '#AA6746',
  Python: '#3572A5',
  Go: '#00ADD8',
  UI: '#E879F9',
  Frontend: '#00E676',
  Backend: '#F59E0B',
  Solana: '#9945FF',
};

export function formatCurrency(amount?: number | string | null, token = 'USDC') {
  const value = Number(amount ?? 0);
  const compact = new Intl.NumberFormat('en-US', {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 2,
  }).format(value);

  if (token?.toUpperCase() === 'USDC') return `$${compact}`;
  return `${compact} ${token}`;
}

export function timeAgo(dateLike?: string | number | Date | null) {
  if (!dateLike) return '—';
  const time = new Date(dateLike).getTime();
  if (Number.isNaN(time)) return '—';

  const diffMs = Date.now() - time;
  const future = diffMs < 0;
  const seconds = Math.max(0, Math.abs(diffMs) / 1000);

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
      const count = Math.round(seconds / unitSeconds);
      return rtf.format(future ? count : -count, unit);
    }
  }
  return future ? 'soon' : 'just now';
}

export function timeLeft(dateLike?: string | number | Date | null) {
  if (!dateLike) return '—';
  const deadline = new Date(dateLike).getTime();
  if (Number.isNaN(deadline)) return '—';

  const diffMs = deadline - Date.now();
  if (diffMs <= 0) return 'Expired';

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
