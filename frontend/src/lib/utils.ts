export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F7DF1E',
  Python: '#3776AB',
  Rust: '#DEA584',
  Solidity: '#363636',
  Go: '#00ADD8',
  Java: '#ED8B00',
  'C++': '#00599C',
  C: '#555555',
  Ruby: '#CC342D',
  Swift: '#FA7343',
  Kotlin: '#7F52FF',
  Dart: '#0175C2',
  HTML: '#E34F26',
  CSS: '#1572B6',
  Shell: '#89E051',
  YAML: '#CB171E',
  JSON: '#292929',
  Markdown: '#083FA1',
};

export function formatCurrency(amount: number, token: string): string {
  if (token === 'USDC') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${token}`;
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function timeLeft(deadline: string): string {
  const end = new Date(deadline).getTime();
  const now = Date.now();
  const diff = end - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}
