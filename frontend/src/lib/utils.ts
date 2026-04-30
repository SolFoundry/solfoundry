export const formatCurrency = (amount: number, token: string = 'FNDRY') => {
  return `${amount.toLocaleString()} ${token}`;
};

export const timeLeft = (date: string | null | undefined) => {
  if (!date) return 'No deadline';
  const diff = new Date(date).getTime() - new Date().getTime();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  return `${hours}h left`;
};

export const LANG_COLORS: Record<string, string> = {
  TypeScript: 'text-blue-400',
  Rust: 'text-orange-500',
  Solidity: 'text-gray-400',
  Python: 'text-yellow-400',
  JavaScript: 'text-yellow-300',
  Go: 'text-cyan-500',
};

export function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export const timeAgo = (date: string | null | undefined) => {
  if (!date) return 'Unknown';
  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};
