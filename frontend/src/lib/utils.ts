export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Java: '#ED8B00',
  Scala: '#DC322F',
  CSS: '#663399',
  HTML: '#E34F26',
  Shell: '#89E051',
  Nix: '#5277C3',
  Solidity: '#363636',
  Vue: '#41B883',
  React: '#61DAFB',
};

export function formatCurrency(amount?: number | null, token?: string | null): string {
  if (amount == null || Number.isNaN(Number(amount))) return token ? `0 ${token}` : '$0';
  const value = Number(amount);
  if (!token || token.toUpperCase() === 'USD' || token.toUpperCase() === 'USDC') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  }
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value)} ${token}`;
}

export function timeAgo(input?: string | number | Date | null): string {
  if (!input) return 'just now';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'just now';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function timeLeft(input?: string | number | Date | null): string {
  if (!input) return 'No deadline';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'No deadline';

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'Ended';

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d left`;
  const months = Math.floor(days / 30);
  return `${months}mo left`;
}
