import { twMerge } from 'tailwind-merge';

export const LANG_COLORS: Record<string, string> = {
  AssemblyScript: '#007AAC',
  C: '#555555',
  'C++': '#f34b7d',
  CSS: '#563d7c',
  Dockerfile: '#384d54',
  Go: '#00ADD8',
  HTML: '#e34c26',
  Java: '#b07219',
  JavaScript: '#f1e05a',
  JSON: '#292929',
  Kotlin: '#A97BFF',
  Move: '#4DA2FF',
  PHP: '#4F5D95',
  Python: '#3572A5',
  Rust: '#dea584',
  Shell: '#89e051',
  Solidity: '#AA6746',
  Swift: '#F05138',
  TypeScript: '#3178c6',
  Vue: '#41b883',
};

type ClassValue = string | false | null | undefined;

export function cn(...classes: ClassValue[]) {
  return twMerge(classes.filter(Boolean).join(' '));
}

export function formatCurrency(amount?: number | string | null, token = 'USDC') {
  const numericAmount = typeof amount === 'string' ? Number(amount) : amount ?? 0;

  if (!Number.isFinite(numericAmount)) {
    return `${amount ?? 0} ${token}`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: numericAmount < 1 ? 4 : 0,
  }).format(numericAmount);

  return token.toUpperCase() === 'USDC' ? `$${formatted}` : `${formatted} ${token}`;
}

export function timeAgo(value?: string | number | Date | null) {
  const date = toDate(value);
  if (!date) return '';

  const diffMs = Date.now() - date.getTime();
  const tense = diffMs >= 0 ? 'ago' : 'from now';
  const seconds = Math.max(0, Math.floor(Math.abs(diffMs) / 1000));

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${tense}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${tense}`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${tense}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ${tense}`;
  return `${Math.floor(months / 12)}y ${tense}`;
}

export function timeLeft(value?: string | number | Date | null) {
  const date = toDate(value);
  if (!date) return '';

  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return 'Ended';

  const minutes = Math.ceil(diffMs / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.ceil(hours / 24);
  if (days < 30) return `${days}d left`;
  const months = Math.ceil(days / 30);
  if (months < 12) return `${months}mo left`;
  return `${Math.ceil(months / 12)}y left`;
}

function toDate(value?: string | number | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
