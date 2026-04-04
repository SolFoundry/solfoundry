export const LANG_COLORS: Record<string, string> = {
  Rust: '#DEA584',
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3572A5',
  Solidity: '#AA6746',
  Go: '#00ADD8',
  C: '#555555',
  'C++': '#F34B7D',
  Java: '#B07219',
  Move: '#4B32C3',
  Anchor: '#7C3AED',
  React: '#61DAFB',
};

export function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);

  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return '<1h left';
}

export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function formatCurrency(amount: number, token?: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  return token ? `${formatted} ${token}` : `$${formatted}`;
}
