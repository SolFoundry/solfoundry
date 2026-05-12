/**
 * Shared formatting + display helpers used across the frontend.
 * Kept dependency-free so they can be imported anywhere.
 */

export function formatCurrency(amount: number, token: string = 'USDC'): string {
  const normalized = token?.toUpperCase?.() ?? 'USDC';
  if (normalized === 'FNDRY') {
    return `${formatCompactNumber(amount)} FNDRY`;
  }
  if (normalized === 'SOL') {
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`;
  }
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}

function diffSeconds(target: Date, base: Date = new Date()): number {
  return Math.round((target.getTime() - base.getTime()) / 1000);
}

export function timeAgo(timestamp: string | number | Date | null | undefined): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = -diffSeconds(date);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

export function timeLeft(deadline: string | number | Date | null | undefined): string {
  if (!deadline) return '—';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = diffSeconds(date);
  if (seconds <= 0) return 'ended';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d left`;
  const months = Math.floor(days / 30);
  return `${months}mo left`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** GitHub-aligned language colors (subset). Falls back to muted grey when absent. */
export const LANG_COLORS: Record<string, string> = {
  Rust: '#DEA584',
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  Python: '#3572A5',
  Go: '#00ADD8',
  Solidity: '#AA6746',
  Move: '#4F5D95',
  React: '#61DAFB',
  Solana: '#9945FF',
  Anchor: '#512BD4',
  CSS: '#563D7C',
  HTML: '#E34F26',
  Shell: '#89E051',
  Docker: '#384D54',
  Frontend: '#40C4FF',
  Backend: '#00E676',
  Smart_Contracts: '#7C3AED',
  Design: '#E040FB',
  Docs: '#A0A0B8',
};
