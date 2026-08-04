import type { Bounty } from '../types/bounty';

export function timeLeft(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function formatCurrency(amount: number, token: string): string {
  if (token === 'USDC') return `$${amount.toLocaleString()} USDC`;
  if (token === 'FNDRY') return `${(amount / 1000).toFixed(0)}K $FNDRY`;
  return `${amount} ${token}`;
}

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3776ab',
  Rust: '#dea584',
  Solidity: '#363636',
  React: '#61dafb',
  'Next.js': '#000000',
  Go: '#00add8',
  Move: '#4a90e2',
  Svelte: '#ff3e00',
  Vue: '#4fc08d',
};
