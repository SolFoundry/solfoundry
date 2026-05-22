export const LANG_COLORS: Record<string, string> = {
  React: '#61DAFB',
  TypeScript: '#3178C6',
  TS: '#3178C6',
  JavaScript: '#F7DF1E',
  JS: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#363636',
  Sol: '#363636',
  Python: '#3776AB',
  Go: '#00ADD8',
  'Next.js': '#FFFFFF',
  GraphQL: '#E535AB',
};

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

export function formatCurrency(amount: number | string, token?: string | null): string {
  const numeric = toNumber(amount);
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? '-' : '';

  const formatted =
    abs >= 1_000_000
      ? `${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}m`
      : abs >= 1_000
        ? `${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`
        : `${abs}`;

  return token ? `${sign}${formatted}` : `${sign}${formatted}`;
}

export function formatRelativeTime(date: Date, now = Date.now()): string {
  const diffMs = date.getTime() - now;
  const absMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const suffix = diffMs >= 0 ? 'from now' : 'ago';
  if (absMs < minute) return diffMs >= 0 ? 'just now' : 'just now';
  if (absMs < hour) {
    const mins = Math.floor(absMs / minute);
    return `${mins} minute${mins === 1 ? '' : 's'} ${suffix}`;
  }
  if (absMs < day) {
    const hrs = Math.floor(absMs / hour);
    return `${hrs} hour${hrs === 1 ? '' : 's'} ${suffix}`;
  }
  const days = Math.floor(absMs / day);
  return `${days} day${days === 1 ? '' : 's'} ${suffix}`;
}

export function timeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return formatRelativeTime(date);
}

function buildCountdownParts(remainingMs: number): { days: number; hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(remainingMs / 60_000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export function formatTimeRemaining(deadline: string, now = Date.now()): string {
  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return 'Expired';

  const remainingMs = deadlineDate.getTime() - now;
  if (remainingMs <= 0) return 'Expired';

  const { days, hours, minutes } = buildCountdownParts(remainingMs);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `0h ${minutes}m`;
}

export function timeLeft(deadline?: string | null, now = Date.now()): string {
  if (!deadline) return '';
  return formatTimeRemaining(deadline, now);
}
