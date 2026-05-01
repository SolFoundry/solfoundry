import { twMerge } from 'tailwind-merge';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  React: '#61DAFB',
  Rust: '#DEA584',
  Solidity: '#627EEA',
  Python: '#3776AB',
  Go: '#00ADD8',
  Solana: '#14F195',
  Anchor: '#9945FF',
};

export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(' '));
}

export function formatCurrency(amount: number, token = 'USDC'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  });
  return `${formatter.format(amount)} ${token}`;
}

export function timeAgo(timestamp: string): string {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) return 'Unknown';
  if (diffMs < 60_000) return 'Just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function timeLeft(timestamp: string): string {
  const date = new Date(timestamp);
  const diffMs = date.getTime() - Date.now();

  if (Number.isNaN(diffMs)) return 'Unknown';
  if (diffMs <= 0) return 'Expired';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m left`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d left`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo left`;

  const years = Math.floor(months / 12);
  return `${years}y left`;
}
