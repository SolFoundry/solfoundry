export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Rust: '#DEA584',
  Solidity: '#AA6746',
  Python: '#3776AB',
  Go: '#00ADD8',
  Ruby: '#CC342D',
  Swift: '#FA7343',
};

export function formatCurrency(amount: number | string | null | undefined, token = 'USDC') {
  const numeric = Number(amount ?? 0);
  const formatted = Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, { maximumFractionDigits: numeric >= 100 ? 0 : 2 })
    : String(amount ?? 0);

  if (token.toUpperCase() === 'USDC' || token === '$') {
    return `$${formatted}`;
  }

  return `${formatted} ${token}`;
}

export function timeLeft(value: string | number | Date) {
  const target = new Date(value).getTime();
  const diffMs = target - Date.now();

  if (!Number.isFinite(target)) return 'No deadline';
  if (diffMs <= 0) return 'Expired';

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return `${Math.max(1, minutes)}m left`;
}

export function timeAgo(value: string | number | Date) {
  const target = new Date(value).getTime();
  const diffMs = Date.now() - target;

  if (!Number.isFinite(target)) return 'recently';
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}
