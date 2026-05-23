export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Solidity: '#AA6746',
  Python: '#3572A5',
  Go: '#00ADD8',
  React: '#61dafb',
  Tailwind: '#38bdf8',
};

export function formatCurrency(amount: number, token: string = 'USDC'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  });
  return `${formatter.format(amount)} ${token}`;
}

export function timeLeft(deadline: string): string {
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d left`;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}h left`;
  
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m left`;
}

export function timeAgo(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 0) return 'just now';
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };
  
  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) {
      return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
    }
  }
  
  return 'just now';
}

