export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Solidity: '#8A92B2',
  React: '#61DAFB',
  Node: '#5FA04E',
};

export function formatCurrency(amount: number | string | null | undefined, token?: string | null): string {
  const n = Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const t = token && token.trim() ? token.trim() : 'FNDRY';
  return `${safe.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t}`;
}

export function timeAgo(input: string | Date | null | undefined): string {
  if (!input) return 'just now';
  const then = new Date(input).getTime();
  if (!Number.isFinite(then)) return 'just now';

  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMon = Math.floor(diffDay / 30);
  if (diffMon < 12) return `${diffMon}mo ago`;
  const diffYr = Math.floor(diffMon / 12);
  return `${diffYr}y ago`;
}

export function timeLeft(input: string | Date | null | undefined): string {
  if (!input) return 'No deadline';
  const end = new Date(input).getTime();
  if (!Number.isFinite(end)) return 'No deadline';

  let diff = end - Date.now();
  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * 1000 * 60 * 60 * 24;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * 1000 * 60 * 60;
  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}
