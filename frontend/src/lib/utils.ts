export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Rust: '#dea584',
  Solidity: '#7c7c7c',
  Python: '#3776ab',
  Go: '#00add8',
  React: '#61dafb',
};

export function formatCurrency(amount: number, token = 'FNDRY'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: amount >= 1000 ? 0 : 2,
  }).format(amount);
  return `${formatted} ${token}`;
}

export function timeLeft(deadline: string): string {
  const deadlineTime = new Date(deadline).getTime();
  const diff = deadlineTime - Date.now();
  if (!Number.isFinite(deadlineTime) || diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function timeAgo(value: string): string {
  const created = new Date(value).getTime();
  const diff = Date.now() - created;
  if (!Number.isFinite(created) || diff < 0) return 'just now';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
