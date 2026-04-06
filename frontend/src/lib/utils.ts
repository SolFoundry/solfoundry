const numberFormatter = new Intl.NumberFormat('en-US');

export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#DEA584',
  Solidity: '#8A92B2',
  Go: '#00ADD8',
  React: '#61DAFB',
};

export function formatCurrency(amount: number, token: string) {
  if (!Number.isFinite(amount)) return `0 ${token}`;
  const compact = amount >= 1000 ? `${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}k` : numberFormatter.format(amount);
  return `${compact} ${token}`;
}

export function timeAgo(input: string) {
  const diffMs = Date.now() - new Date(input).getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function timeLeft(input: string) {
  const diffMs = new Date(input).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}
