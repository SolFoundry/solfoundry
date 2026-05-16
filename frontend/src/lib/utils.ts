const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export const LANG_COLORS: Record<string, string> = {
  typescript: '#3178C6',
  javascript: '#F7DF1E',
  python: '#3776AB',
  rust: '#CE422B',
  go: '#00ADD8',
  solidity: '#8A92B2',
  react: '#61DAFB',
  nextjs: '#F0F0F5',
  tailwind: '#38BDF8',
};

function toDate(value?: string | number | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelative(target: Date): string {
  const now = Date.now();
  const diffMs = target.getTime() - now;
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) return rtf.format(diffSeconds, 'second');

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month');

  const diffYears = Math.round(diffMonths / 12);
  return rtf.format(diffYears, 'year');
}

export function timeAgo(value?: string | number | Date | null): string {
  const date = toDate(value);
  if (!date) return 'unknown';
  return formatRelative(date);
}

export function timeLeft(value?: string | number | Date | null): string {
  const date = toDate(value);
  if (!date) return 'no deadline';

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'ended';

  const diffMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(diffMinutes / 1440);
  const hours = Math.floor((diffMinutes % 1440) / 60);
  const minutes = diffMinutes % 60;

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${Math.max(minutes, 1)}m left`;
}

export function formatCurrency(amount?: number | string | null, token?: string | null): string {
  const numericAmount = typeof amount === 'string' ? Number(amount) : amount ?? 0;
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
  const upperToken = token?.trim()?.toUpperCase() || 'USD';

  if (upperToken === 'USDC' || upperToken === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: safeAmount >= 100 ? 0 : 2,
    }).format(safeAmount);
  }

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: safeAmount >= 100 ? 0 : 2,
  }).format(safeAmount);

  return `${formatted} ${upperToken}`;
}
