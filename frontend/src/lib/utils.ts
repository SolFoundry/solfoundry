export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#363636',
  Python: '#3572A5',
  Go: '#00ADD8',
  Java: '#B07219',
};

export function timeLeft(deadline: string): string {
  const now = Date.now();
  const end = new Date(deadline).getTime();
  const diff = end - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function formatCurrency(amount: number, token: string): string {
  if (token === 'FNDRY') {
    if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M $FNDRY`;
    if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K $FNDRY`;
    return `${amount.toLocaleString()} $FNDRY`;
  }
  return `$${amount.toLocaleString()}`;
}