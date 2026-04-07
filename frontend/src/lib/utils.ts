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

export function formatCurrency(amount: number, token: string): string {
  if (token === 'USDC') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USDC`;
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${token}`;
}

export function timeLeft(deadline: string): string {
  if (!deadline) return 'Expired';
  const deadlineMs = new Date(deadline).getTime();
  if (Number.isNaN(deadlineMs)) return 'Expired';
  const now = Date.now();
  const diff = deadlineMs - now;

  if (diff <= 0) return 'Expired';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return 'invalid date';
  const dateMs = new Date(dateStr).getTime();
  if (Number.isNaN(dateMs)) return 'invalid date';
  const now = Date.now();
  const diff = now - dateMs;

  if (diff < 0) return 'in the future';

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
