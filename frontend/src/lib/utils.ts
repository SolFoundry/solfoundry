import type { RewardToken } from '../types/bounty';

/** GitHub-style accent colors for skills / languages (extend as needed). */
export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  typescript: '#3178c6',
  TS: '#3178c6',
  JavaScript: '#f7df1e',
  javascript: '#f7df1e',
  JS: '#f7df1e',
  Rust: '#dea584',
  rust: '#dea584',
  Go: '#00ADD8',
  go: '#00ADD8',
  Python: '#3776ab',
  python: '#3776ab',
  Solidity: '#AA6746',
  solidity: '#AA6746',
  Java: '#b07219',
  java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  cpp: '#f34b7d',
  'C#': '#178600',
  'c#': '#178600',
  Ruby: '#701516',
  ruby: '#701516',
  PHP: '#4F5D95',
  php: '#4F5D95',
  Swift: '#F05138',
  swift: '#F05138',
  Kotlin: '#A97BFF',
  kotlin: '#A97BFF',
  Scala: '#c22d40',
  scala: '#c22d40',
  HTML: '#e34c26',
  html: '#e34c26',
  CSS: '#563d7c',
  css: '#563d7c',
  Shell: '#89e051',
  shell: '#89e051',
  Bash: '#89e051',
  React: '#61dafb',
  react: '#61dafb',
  Vue: '#41b883',
  vue: '#41b883',
  Svelte: '#ff3e00',
  svelte: '#ff3e00',
  Node: '#3c873a',
  node: '#3c873a',
  SQL: '#e38c00',
  sql: '#e38c00',
  Docker: '#2496ed',
  docker: '#2496ed',
};

export function formatCurrency(amount: number, token: RewardToken): string {
  if (!Number.isFinite(amount)) return '—';
  if (token === 'USDC') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  return `${amount.toLocaleString('en-US')} FNDRY`;
}

export function timeLeft(deadline: string | null | undefined): string {
  if (!deadline) return 'No deadline';
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return 'No deadline';
  const diff = end - Date.now();
  if (diff <= 0) return 'Ended';
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const d = Math.floor(hr / 24);
  if (d > 0) return d === 1 ? '1 day left' : `${d} days left`;
  if (hr > 0) return hr === 1 ? '1 hour left' : `${hr} hours left`;
  if (min > 0) return min === 1 ? '1 min left' : `${min} mins left`;
  return 'Less than a min';
}

export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 0) return 'just now';
  if (sec < 60) return sec <= 1 ? 'just now' : `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1m ago' : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1h ago' : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return d === 1 ? '1d ago' : `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return w === 1 ? '1w ago' : `${w}w ago`;
  const mo = Math.floor(d / 30);
  return mo <= 1 ? '1mo ago' : `${mo}mo ago`;
}
