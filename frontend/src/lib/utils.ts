export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount: number | string, token = 'FNDRY'): string {
  const num = typeof amount === 'string' ? Number(amount) : amount;
  if (isNaN(num)) return `0 $${token}`;

  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M $${token}`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K $${token}`;
  }
  return `${num.toLocaleString()} $${token}`;
}

export function timeLeft(deadline: string | number | Date): string {
  const now = Date.now();
  const target = new Date(deadline).getTime();
  const diff = target - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);

  if (days > 0) return `${days}d ${hours}h left`;
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m left`;
}

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  Rust: '#DEA584',
  Solidity: '#363636',
  Go: '#00ADD8',
  Java: '#B07219',
  C: '#555555',
  'C++': '#F34B7D',
  Ruby: '#701516',
  Move: '#4F46E5',
  'Cairo': '#FF6900',
};

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function timeAgo(date: string | number | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);

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

/**
 * Generate a deterministic skeleton key for React list rendering.
 * Avoids rendering real data shapes during loading.
 */
export function skeletonKey(index: number, prefix = 'skeleton'): string {
  return `${prefix}-${index}`;
}
