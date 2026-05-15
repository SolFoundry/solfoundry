export const LANG_COLORS: Record<string, string> = {
  All: '#5C5C78',
  Rust: '#F97316',
  TypeScript: '#3178C6',
  React: '#61DAFB',
  'Solana/Web3': '#14F195',
  Python: '#3776AB',
  Go: '#00ADD8',
  Solidity: '#627EEA',
};

export function formatCurrency(amount: number, token = 'USDC'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
  return `${formatted} ${token}`;
}

export function timeLeft(deadline?: string | null): string {
  if (!deadline) return 'No deadline';

  const target = new Date(deadline).getTime();
  const diff = target - Date.now();
  if (!Number.isFinite(target) || diff <= 0) return 'Expired';

  const days = Math.floor(diff / 86_400_000);
  if (days > 0) return `${days}d left`;

  const hours = Math.floor(diff / 3_600_000);
  if (hours > 0) return `${hours}h left`;

  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `${minutes}m left`;
}

export function timeAgo(value?: string | null): string {
  if (!value) return 'Unknown';

  const date = new Date(value).getTime();
  const diff = Date.now() - date;
  if (!Number.isFinite(date)) return 'Unknown';
  if (diff < 60_000) return 'just now';

  const minutes = Math.floor(diff / 60_000);
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
