export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f7df1e', React: '#61dafb', Rust: '#dea584', Solana: '#14f195', Solidity: '#627eea', Python: '#3776ab', Go: '#00add8', CSS: '#563d7c', HTML: '#e34c26', TS: '#3178c6'
};

export function formatCurrency(amount: number, token = 'USDC'): string {
  const value = Number(amount ?? 0);
  const compact = value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : `${value}`;
  return `${compact} ${token}`;
}

export function timeAgo(input: string): string {
  const diff = Date.now() - new Date(input).getTime();
  if (!Number.isFinite(diff)) return 'unknown';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function timeLeft(input: string): string {
  const diff = new Date(input).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'Expired';
  const minutes = Math.floor(diff / 60000) % 60;
  const hours = Math.floor(diff / 3600000) % 24;
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function deadlineUrgency(input?: string | null): 'normal' | 'warning' | 'urgent' | 'expired' {
  if (!input) return 'normal';
  const diff = new Date(input).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return 'expired';
  if (diff < 3600000) return 'urgent';
  if (diff < 86400000) return 'warning';
  return 'normal';
}
