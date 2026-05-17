export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  React: '#61dafb',
  Python: '#3776ab',
  Rust: '#dea584',
  Solana: '#14f195',
  Solidity: '#627eea',
  Go: '#00add8',
  'C++': '#00599c',
  CSS: '#663399',
  HTML: '#e34f26',
  Docs: '#a78bfa',
};

export function formatCurrency(amount?: number | null, token = 'USDC') {
  const safeAmount = Number.isFinite(amount ?? NaN) ? Number(amount) : 0;

  if (token === 'FNDRY') {
    return `${compactNumber(safeAmount)} FNDRY`;
  }

  if (token === 'USDC') {
    return `$${compactNumber(safeAmount)} USDC`;
  }

  return `${compactNumber(safeAmount)} ${token}`;
}

export function timeAgo(value?: string | Date | null) {
  const date = toDate(value);
  if (!date) return 'unknown';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const suffix = seconds < 0 ? 'from now' : 'ago';
  const absolute = Math.abs(seconds);

  if (absolute < 60) return 'just now';
  if (absolute < 3600) return `${Math.round(absolute / 60)}m ${suffix}`;
  if (absolute < 86400) return `${Math.round(absolute / 3600)}h ${suffix}`;
  if (absolute < 2592000) return `${Math.round(absolute / 86400)}d ${suffix}`;
  if (absolute < 31536000) return `${Math.round(absolute / 2592000)}mo ${suffix}`;
  return `${Math.round(absolute / 31536000)}y ${suffix}`;
}

export function timeLeft(value?: string | Date | null) {
  const date = toDate(value);
  if (!date) return 'No deadline';

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (seconds <= 0) return 'Expired';
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m left`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)}h left`;
  return `${Math.ceil(seconds / 86400)}d left`;
}

function toDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function compactNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trimTrailingZero(value / 1_000_000)}M`;
  if (abs >= 1_000) return `${trimTrailingZero(value / 1_000)}k`;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function trimTrailingZero(value: number) {
  return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, '');
}
