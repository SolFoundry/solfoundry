/**
 * Format a date string into a human-readable "time left" string.
 * e.g. "3d 5h 12m", "23h 45m", "Expired"
 */
export function timeLeft(deadline: string): string {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Expired';
  }

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get detailed time breakdown for countdown display.
 * Returns parts array for flexible rendering.
 */
export function getTimeParts(deadline: string): { days: number; hours: number; minutes: number; seconds: number; expired: boolean } {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, expired: false };
}

/**
 * Format a date string into a human-readable "time ago" string.
 * e.g. "2h ago", "3d ago"
 */
export function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diff = now.getTime() - past.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return past.toLocaleDateString();
}

/**
 * Format a currency amount with token symbol.
 */
export function formatCurrency(amount: number, token: string): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${token}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K ${token}`;
  }
  return `${amount.toLocaleString()} ${token}`;
}

/**
 * Language/tech colors for skill tags.
 */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#CE422B',
  Go: '#00ADD8',
  Solidity: '#363636',
  React: '#61DAFB',
  Vue: '#4FC08D',
  Svelte: '#FF3E00',
  Node: '#339933',
  HTML: '#E34F26',
  CSS: '#1572B6',
  SQL: '#4479A1',
  GraphQL: '#E10098',
  Docker: '#2496ED',
  Kubernetes: '#326CE5',
  AWS: '#FF9900',
  GCP: '#4285F4',
  Azure: '#0078D4',
  Solana: '#9945FF',
  Ethereum: '#627EEA',
};
