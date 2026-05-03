export const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
  JavaScript: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
  Rust: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  Solidity: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
  React: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
};

export function formatCurrency(value: number, token = 'FNDRY'): string {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} ${token}`;
}

export function timeAgo(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function timeLeft(value?: string | null): string {
  if (!value) return 'No deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No deadline';
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays === 1) return '1 day left';
  return `${diffDays} days left`;
}
