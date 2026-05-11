import type { RewardToken } from '../types/bounty';

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#AA6746',
  Python: '#3776AB',
  Go: '#00ADD8',
  React: '#61DAFB',
  Solana: '#14F195',
};

export function formatCurrency(amount: number, token: RewardToken | string = 'USDC') {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);

  return token === 'USDC' ? `$${formatted}` : `${formatted} ${token}`;
}

export function timeAgo(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return `${Math.floor(diffMonths / 12)}y ago`;
}

export function timeLeft(date: string) {
  const diffMs = new Date(date).getTime() - Date.now();

  if (diffMs <= 0) return 'expired';

  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m left`;

  const diffHours = Math.ceil(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h left`;

  const diffDays = Math.ceil(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d left`;

  const diffMonths = Math.ceil(diffDays / 30);
  return `${diffMonths}mo left`;
}
