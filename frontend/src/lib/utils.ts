/**
 * Shared formatting helpers for the frontend.
 * @module lib/utils
 */

/** Accent colors for skill / language chips (matches leaderboard). */
export const LANG_COLORS: Record<string, string> = {
  Rust: '#DEA584',
  TypeScript: '#3178C6',
  Python: '#3776AB',
  JavaScript: '#F7DF1E',
  Solana: '#9945FF',
  React: '#61DAFB',
  Go: '#00ADD8',
  Solidity: '#AA6746',
};

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function timeLeft(deadlineIso: string): string {
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.floor((d.getTime() - Date.now()) / 1000);
  if (sec <= 0) return 'Ended';
  const days = Math.floor(sec / 86400);
  const hrs = Math.floor((sec % 86400) / 3600);
  if (days > 0) return `${days}d ${hrs}h left`;
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}
