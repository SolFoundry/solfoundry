export function timeAgo(date: string | Date): string {
  if (!date) return 'unknown';
  const now = Date.now();
  const then = new Date(date).getTime();
  if (isNaN(then)) return 'unknown';
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatCurrency(amount: number | null | undefined, token?: string): string {
  if (amount == null) return '—';
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${token ?? ''}`.trim();
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K ${token ?? ''}`.trim();
  return `${amount.toLocaleString()} ${token ?? ''}`.trim();
}

export function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}

export function formatUSD(amount: number): string {
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

export function getDeadlineStatus(date: string | Date): string {
  if (!date) return '—';
  const now = Date.now();
  const then = new Date(date).getTime();
  if (isNaN(then)) return '—';
  const diff = then - now;
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h left`;
  return `${Math.floor(diff / 60000)}m left`;
}

export function timeLeft(date: string | Date): string {
  if (!date) return '—';
  const now = Date.now();
  const then = new Date(date).getTime();
  if (isNaN(then)) return '—';
  const diff = then - now;
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h left`;
  return `${Math.floor(diff / 60000)}m left`;
}

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  Rust: '#DEA584',
  Solidity: '#363636',
  Go: '#00ADD8',
  Java: '#B07219',
  'C++': '#F34B7D',
  C: '#555555',
  HTML: '#E34F26',
  CSS: '#563D7C',
  Shell: '#89E051',
  Ruby: '#701516',
  Vue: '#4FC08D',
  React: '#61DAFB',
};