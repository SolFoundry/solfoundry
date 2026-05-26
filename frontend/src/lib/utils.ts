const RELATIVE_TIME_UNITS = [
  { label: 'year', seconds: 365 * 24 * 60 * 60 },
  { label: 'month', seconds: 30 * 24 * 60 * 60 },
  { label: 'week', seconds: 7 * 24 * 60 * 60 },
  { label: 'day', seconds: 24 * 60 * 60 },
  { label: 'hour', seconds: 60 * 60 },
  { label: 'minute', seconds: 60 },
] as const;

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solidity: '#627eea',
  Python: '#3776ab',
  Go: '#00add8',
  React: '#61dafb',
  Node: '#68a063',
  Other: '#5c5c78',
};

export function formatCurrency(amount?: number | null, token = 'USDC'): string {
  const value = Number(amount ?? 0);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);

  return `${formatted} ${token}`;
}

export function timeAgo(timestamp?: string | null): string {
  if (!timestamp) return 'unknown';

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'unknown';

  const deltaSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (deltaSeconds < 30) return 'just now';

  for (const unit of RELATIVE_TIME_UNITS) {
    const value = Math.floor(deltaSeconds / unit.seconds);
    if (value >= 1) {
      return `${value} ${unit.label}${value === 1 ? '' : 's'} ago`;
    }
  }

  return 'just now';
}

export function timeLeft(deadline?: string | null): string {
  if (!deadline) return 'No deadline';

  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return 'Invalid deadline';

  const deltaMs = date.getTime() - Date.now();
  if (deltaMs <= 0) return 'Expired';

  const totalMinutes = Math.floor(deltaMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(minutes, 1)}m left`;
}
