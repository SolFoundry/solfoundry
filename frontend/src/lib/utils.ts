/**
 * Shared utility functions for SolFoundry frontend.
 */
import type { Variants } from 'framer-motion';

/** Language color mapping for inline code dots */
export const LANG_COLORS: Record<string, string> = {
  JavaScript: '#f7df1e',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Rust: '#dea584',
  Solidity: '#363636',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Java: '#b07219',
  Go: '#00ADD8',
  Ruby: '#701516',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Shell: '#89e051',
  Markdown: '#083fa1',
};

/**
 * Format a deadline timestamp into a human-readable "time left" string.
 * Returns "X days left", "X hours left", "X minutes left", or "Expired".
 */
export function timeLeft(deadline: string | number | Date): string {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
  const now = Date.now();
  const diff = deadlineMs - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/**
 * Format a timestamp into a relative "time ago" string.
 */
export function timeAgo(date: string | number | Date): string {
  const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const diff = Date.now() - ms;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/**
 * Format a currency amount + token symbol.
 */
export function formatCurrency(amount: number | string, token?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0';
  const sym = token ?? '$FNDRY';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M ${sym}`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K ${sym}`;
  return `${num.toLocaleString()} ${sym}`;
}

/**
 * Compute countdown values from a deadline timestamp.
 * Returns { days, hours, minutes, seconds, isExpired, isUrgent, isWarning }.
 */
export function getCountdownValues(deadline: string | number | Date) {
  const deadlineMs = deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime();
  const now = Date.now();
  const diff = deadlineMs - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isUrgent: false, isWarning: false };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    isUrgent: totalSeconds < 3600, // < 1 hour
    isWarning: totalSeconds < 86400 && totalSeconds >= 3600, // 1-24 hours
  };
}