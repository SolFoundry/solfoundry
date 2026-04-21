import { twMerge } from 'tailwind-merge';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solana: '#14f195',
  React: '#61dafb',
  Python: '#3776ab',
  Go: '#00add8',
  Backend: '#9b87f5',
  Frontend: '#34d399',
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(' '));
}

export function formatCurrency(amount: number, token: string) {
  const compact = amount >= 1_000_000
    ? `${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`
    : amount >= 1_000
      ? `${(amount / 1_000).toFixed(amount % 1_000 === 0 ? 0 : 1)}K`
      : amount.toLocaleString();

  return `${compact} ${token}`;
}

export function timeAgo(date: string) {
  const timestamp = new Date(date).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

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

export function timeLeft(date: string) {
  const diff = new Date(date).getTime() - Date.now();

  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h left`;
  if (hours > 0) return `${hours}h ${minutes % 60}m left`;

  return `${Math.max(1, minutes)}m left`;
}
