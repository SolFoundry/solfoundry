export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Solidity: '#AA6746',
  React: '#61dafb',
  Next: '#ffffff',
  Frontend: '#00E676',
  Backend: '#E040FB',
  Docs: '#8b949e',
};

export function formatCurrency(amount: number, token = 'USDC'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const normalizedToken = token.toUpperCase();

  if (normalizedToken === 'USDC' || normalizedToken === 'USD') {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${token}`;
}

export function timeAgo(value: string | Date): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (!Number.isFinite(diffMs)) return '';

  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;

  return `${Math.floor(months / 12)}y ago`;
}

export function timeLeft(value: string | Date): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return '';
  if (diffMs <= 0) return 'Expired';

  const minutes = Math.ceil(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m left`;

  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;

  const days = Math.ceil(hours / 24);
  return `${days}d left`;
}
