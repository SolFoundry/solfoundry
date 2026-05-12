import { twMerge } from 'tailwind-merge';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solidity: '#627eea',
  Python: '#3776ab',
  Go: '#00add8',
  React: '#61dafb',
  Next: '#ffffff',
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(' '));
}

export function formatCurrency(amount: number, token = 'FNDRY') {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: token === 'USDC' ? 2 : 0,
  }).format(amount);

  return token === 'USDC' ? `$${formatted}` : `${formatted} ${token}`;
}

export function timeAgo(value: string | Date) {
  const date = new Date(value);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function timeLeft(value: string | Date) {
  const date = new Date(value);
  const seconds = Math.floor((date.getTime() - Date.now()) / 1000);

  if (seconds <= 0) return 'Expired';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d left`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo left`;
  return `${Math.floor(months / 12)}y left`;
}
