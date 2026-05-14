export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dea584',
  Solidity: '#aa6746',
  Python: '#3572a5',
  Go: '#00add8',
  React: '#61dafb',
  TS: '#3178c6',
  Sol: '#9945ff',
};

export function formatCurrency(amount: number, token = 'FNDRY') {
  const formatted =
    amount >= 1_000_000
      ? `${(amount / 1_000_000).toFixed(1)}M`
      : amount >= 1_000
        ? `${(amount / 1_000).toFixed(1)}k`
        : amount.toLocaleString();

  return `${formatted} ${token}`;
}

export function timeAgo(date: string | Date) {
  const timestamp = new Date(date).getTime();
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;

  return `${Math.floor(diffMonths / 12)}y ago`;
}

export function timeLeft(date: string | Date) {
  const timestamp = new Date(date).getTime();
  const diffMs = timestamp - Date.now();

  if (diffMs <= 0) return 'Expired';

  const diffHours = Math.ceil(diffMs / 3_600_000);
  if (diffHours < 24) return `${diffHours}h left`;

  const diffDays = Math.ceil(diffHours / 24);
  return `${diffDays}d left`;
}
