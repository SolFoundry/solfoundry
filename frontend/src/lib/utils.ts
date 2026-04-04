/**
 * Returns a human-readable string for how much time is left until a deadline.
 * e.g. "5d 3h", "23h 59m", "59m", "Expired"
 */
export function timeLeft(deadline: string): string {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diff = deadlineMs - now;

  if (diff <= 0) return 'Expired';

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

/**
 * Returns a CSS color for a given programming language.
 */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Rust: '#dea584',
  Solidity: '#AAccDD',
  Go: '#00ADD8',
  Java: '#b07219',
  Ruby: '#701516',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Cpp: '#f34b7d',
  C: '#555555',
};

/**
 * Formats a reward amount with token symbol.
 */
export function formatCurrency(amount: number, token: string): string {
  const symbol = token === 'USDC' ? '$' : '';
  if (amount >= 1000) {
    return `${symbol}${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${token}`;
  }
  return `${symbol}${amount} ${token}`;
}

/**
 * Returns a human-readable string for how long ago something happened.
 * e.g. "2 hours ago", "3 days ago"
 */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const dateMs = new Date(dateStr).getTime();
  const diff = now - dateMs;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
