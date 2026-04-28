export { cn } from './cn';

/** Language → color mapping for skill badges. */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572a5',
  Rust: '#dea584',
  Go: '#00add8',
  'C++': '#f34b7d',
  C: '#555555',
  Java: '#b07219',
  Ruby: '#701516',
  Swift: '#f05138',
  Kotlin: '#a97bff',
  Dart: '#00b4ab',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Solidity: '#aa6746',
  Move: '#4a154b',
  Cairo: '#e26127',
  Solana: '#9945ff',
  React: '#61dafb',
  NextJS: '#ffffff',
  NodeJS: '#68a063',
};

/** Return a human-readable "time left" string from a deadline. */
export function timeLeft(deadline: string | Date): string {
  const end = new Date(deadline).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);

  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

/** Return a human-readable "time ago" string from a timestamp. */
export function timeAgo(date: string | Date): string {
  const then = new Date(date).getTime();
  const diff = Date.now() - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y ago`;
  if (months > 0) return `${months}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

/** Format a reward amount with token symbol. */
export function formatCurrency(amount: number, token: string = 'FNDRY'): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M ${token}`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(1)}K ${token}`;
  }
  return `${amount.toLocaleString()} ${token}`;
}
