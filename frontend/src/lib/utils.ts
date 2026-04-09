// Language colors for skills
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#AA6746',
  Python: '#3776AB',
  Go: '#00ADD8',
  Java: '#B07219',
  'C++': '#f34b7d',
  C: '#555555',
  Ruby: '#CC342D',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  React: '#61DAFB',
  Vue: '#4FC08D',
  Angular: '#DD0031',
  CSS: '#563d7c',
  HTML: '#E34C26',
  SQL: '#e38c00',
  Shell: '#89e051',
};

// Format currency with token
export function formatCurrency(amount: number, token?: string): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k ${token || ''}`.trim();
  }
  return `${amount} ${token || ''}`.trim();
}

// Calculate time left from deadline
export function timeLeft(deadline: string): string {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return '<1h left';
}

// Calculate time ago from date
export function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
