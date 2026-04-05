/** Utility functions for SolFoundry frontend */

/**
 * Format currency value with symbol
 */
export const formatCurrency = (value: number, symbol = "$"): string => {
  return `${symbol}${value.toLocaleString()}`;
};

/**
 * Format time ago from date
 */
export const timeAgo = (date: string | Date): string => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Calculate time left until deadline
 */
export const timeLeft = (deadline: string | Date): string => {
  const now = new Date();
  const end = new Date(deadline);
  const seconds = Math.floor((end.getTime() - now.getTime()) / 1000);

  if (seconds <= 0) return "Expired";
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}d left`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h left`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m left`;
};

/**
 * Language colors for syntax highlighting
 */
export const LANG_COLORS: Record<string, string> = {
  typescript: "#3178c6",
  javascript: "#f7df1e",
  python: "#3776ab",
  rust: "#dea584",
  go: "#00add8",
  solidity: "#aa6746",
};
