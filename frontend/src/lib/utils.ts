import { twMerge } from 'tailwind-merge';

export function cn(...inputs: any[]) {
  return twMerge(inputs.filter(Boolean).join(' '));
}

export function formatCurrency(amount: number, token: string = 'FNDRY'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return token === 'USDC' ? `$${formatted}` : `${formatted} ${token}`;
}

export function timeLeft(deadline: string | null | undefined): string {
  if (!deadline) return 'No deadline';
  const target = new Date(deadline).getTime();
  const now = new Date().getTime();
  const diff = target - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;

  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes} min${minutes > 1 ? 's' : ''} left`;
}

export function timeAgo(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  Rust: '#dea584',
  Solidity: '#aa67cf',
  Python: '#3572A5',
  Go: '#00ADD8',
  JavaScript: '#f1e05a',
  All: '#ffffff',
};
