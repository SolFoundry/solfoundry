import type { RewardToken } from '../types/bounty';

/**
 * Human-readable time remaining until a deadline.
 * Static (non-updating) version — for live ticking, use the
 * <CountdownTimer> component instead.
 */
export function timeLeft(deadline: string | null | undefined): string {
  if (!deadline) return 'No deadline';
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'Invalid date';
  if (ms <= 0) return 'Expired';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Relative "x ago" label for a past ISO timestamp. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Formats a reward amount with its token symbol. */
export function formatCurrency(amount: number, token?: RewardToken | string | null): string {
  const symbol = token ?? 'FNDRY';
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return `${formatted} ${symbol}`;
}

/** Language → dot color mapping for skill badges. */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Solidity: '#AA6746',
  'C++': '#f34b7d',
  C: '#555555',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Markdown: '#083fa1',
  Docs: '#8b5cf6',
  Design: '#ff61d8',
  Video: '#f59e0b',
};
