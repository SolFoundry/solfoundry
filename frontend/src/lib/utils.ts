/**
 * Mapping of programming language names to their canonical brand colors.
 * Used for skill/tag badges throughout the UI.
 */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#CE422B',
  Go: '#00ADD8',
  Solidity: '#363636',
  Ruby: '#CC342D',
  Java: '#B07219',
  'C++': '#F34B7D',
  C: '#555555',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
  Dart: '#00B4AB',
  Elixir: '#6E4A7E',
  Haskell: '#5E5086',
  Lua: '#000080',
  Shell: '#89E051',
  Zig: '#EC915C',
};

/**
 * Format a numeric token amount into a human-readable currency string.
 * USDC amounts are prefixed with "$" and show "USDC" explicitly;
 * other tokens display the raw amount followed by the token symbol.
 *
 * @param amount - The numeric amount of the token
 * @param token  - The token symbol (e.g. "USDC", "SOL")
 */
export function formatCurrency(amount: number, token: string): string {
  if (token === 'USDC') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} USDC`;
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${token}`;
}

/**
 * Returns a human-readable string describing the time remaining until a deadline.
 * Returns "Expired" if the deadline has already passed.
 *
 * @param deadline - ISO-8601 date string or any parseable date string
 */
export function timeLeft(deadline: string): string {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diff = deadlineMs - now;

  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/**
 * Returns a human-readable "time ago" string for a past date.
 * e.g. "2d ago", "5h ago", "just now".
 *
 * @param dateStr - ISO-8601 date string or any parseable date string
 */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const dateMs = new Date(dateStr).getTime();
  const diff = now - dateMs;

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
