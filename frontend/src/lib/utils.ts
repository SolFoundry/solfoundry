// Utility functions for SolFoundry frontend

import type { RewardToken } from '../types/bounty';

/**
 * Calculate time remaining and return a formatted string
 * Shows days/hours/minutes/seconds for active bounties
 * Returns 'Expired' for past deadlines
 */
export function timeLeft(deadline: string | Date): string {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Expired';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Format time ago for past dates
 */
export function timeAgo(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}y ago`;
  if (months > 0) return `${months}mo ago`;
  if (weeks > 0) return `${weeks}w ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Format currency amount with token symbol
 */
export function formatCurrency(amount: number, token: RewardToken): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${token}`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k ${token}`;
  }
  return `${amount} ${token}`;
}

/**
 * Language/skill colors for display
 */
export const LANG_COLORS: Record<string, string> = {
  // Programming languages
  'JavaScript': '#F7DF1E',
  'TypeScript': '#3178C6',
  'Python': '#3776AB',
  'Rust': '#DEA584',
  'Go': '#00ADD8',
  'Java': '#007396',
  'C++': '#00599C',
  'C': '#A8B9CC',
  'C#': '#239120',
  'Ruby': '#CC342D',
  'PHP': '#777BB4',
  'Swift': '#F05138',
  'Kotlin': '#7F52FF',
  'Solidity': '#AA6746',
  'Move': '#1E90FF',
  // Frameworks/Libraries
  'React': '#61DAFB',
  'Vue': '#4FC08D',
  'Angular': '#DD0031',
  'Svelte': '#FF3E00',
  'Next.js': '#000000',
  'Node.js': '#339933',
  'Express': '#404040',
  'Django': '#092E20',
  'Flask': '#000000',
  'Rails': '#CC0000',
  'Laravel': '#FF2D20',
  'Spring': '#6DB33F',
  // Blockchain/Web3
  'Solana': '#9945FF',
  'Ethereum': '#3C3C3D',
  'Web3.js': '#F16822',
  'Ethers.js': '#2535A0',
  'Anchor': '#C4187D',
  'Hardhat': '#FFF100',
  'Foundry': '#000000',
  // Other
  'SQL': '#003B57',
  'MongoDB': '#47A248',
  'PostgreSQL': '#336791',
  'Docker': '#2496ED',
  'Kubernetes': '#326CE5',
  'AWS': '#FF9900',
  'GraphQL': '#E10098',
  'REST': '#009688',
  'Git': '#F05032',
  'CI/CD': '#4A90E2',
  'Testing': '#15C213',
  'DevOps': '#FF6C37',
  // Default
  'default': '#888888',
};

/**
 * Format time remaining with full breakdown for countdown display
 * Returns an object with days, hours, minutes, seconds
 */
export function getTimeRemaining(deadline: string | Date): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  isExpired: boolean;
} {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const total = deadlineDate.getTime() - now.getTime();

  if (total <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true };
  }

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((total % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds, total, isExpired: false };
}

/**
 * Check if a deadline is urgent (less than 24 hours remaining)
 */
export function isUrgent(deadline: string | Date): boolean {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const diff = deadlineDate.getTime() - now.getTime();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

/**
 * Check if a deadline is critical (less than 1 hour remaining)
 */
export function isCritical(deadline: string | Date): boolean {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const now = new Date();
  const diff = deadlineDate.getTime() - now.getTime();
  return diff > 0 && diff < 60 * 60 * 1000;
}
