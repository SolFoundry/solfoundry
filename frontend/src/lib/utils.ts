const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const LANG_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  typescript: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  python: 'bg-green-500/15 text-green-300 border-green-500/30',
  rust: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  solidity: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  react: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  default: 'bg-forge-800 text-text-secondary border-border',
};

export function timeAgo(value: string | Date): string {
  const timestamp = new Date(value).getTime();
  const delta = Date.now() - timestamp;

  if (!Number.isFinite(timestamp)) return 'just now';
  if (delta < MINUTE) return 'just now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m ago`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h ago`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

export function timeLeft(value?: string | Date | null): string {
  if (!value) return 'No deadline';

  const timestamp = new Date(value).getTime();
  const delta = timestamp - Date.now();

  if (!Number.isFinite(timestamp)) return 'No deadline';
  if (delta <= 0) return 'Expired';
  if (delta < HOUR) return `${Math.max(1, Math.floor(delta / MINUTE))}m left`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h left`;

  return `${Math.ceil(delta / DAY)}d left`;
}

export function formatCurrency(amount: number, currency = 'USDC'): string {
  if (!Number.isFinite(amount)) return `0 ${currency}`;

  if (currency === 'FNDRY') {
    return `${amount.toLocaleString()} ${currency}`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USDC' ? 'USD' : 'USD',
    maximumFractionDigits: amount >= 100 ? 0 : 2,
  }).format(amount);
}
