export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#363636',
  Python: '#3572A5',
  Go: '#00ADD8',
  HTML: '#E34F26',
  CSS: '#563D7C',
  React: '#61DAFB',
  Vue: '#4FC08D',
};

export function formatCurrency(amount: number, token: string): string {
  const abs = Math.abs(amount);
  if (token === 'FNDRY') {
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M $FNDRY`;
    if (abs >= 1_000) return `${(abs / 1_000).toFixed(1)}K $FNDRY`;
    return `${abs.toLocaleString()} $FNDRY`;
  }
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${abs.toLocaleString()}`;
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

export function timeLeft(deadline: string): string {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diffMs = deadlineMs - now;

  if (diffMs <= 0) return 'Expired';

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number; // total ms remaining
  expired: boolean;
}

export function getCountdownValues(deadline: string): CountdownValues {
  const now = Date.now();
  const deadlineMs = new Date(deadline).getTime();
  const diffMs = deadlineMs - now;

  if (diffMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, expired: true };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return { days, hours, minutes, seconds, total: diffMs, expired: false };
}