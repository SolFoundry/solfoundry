export const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Rust: '#dee5e7',
  Go: '#00add8',
  Python: '#3572a5',
  Solidity: '#aa6746',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
};

export function formatCurrency(amount: number, token = 'USD'): string {
  if (amount === undefined || amount === null) return '0.00';
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(amount);
  
  if (token === 'USD' || token === '$') {
    return `$${formatted}`;
  }
  return `${formatted} ${token}`;
}

export function timeAgo(dateInput: string | Date | number): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 0) return 'just now';

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) {
      return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
    }
  }
  return 'just now';
}

export function timeLeft(dateInput: string | Date | number): string {
  if (!dateInput) return 'No deadline';
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Expired';
  }

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} left`;
  }
  
  const remainingHours = diffHours % 24;
  const remainingMins = diffMins % 60;

  if (diffHours > 0) {
    return `${remainingHours}h ${remainingMins}m left`;
  }
  
  if (diffMins > 0) {
    return `${diffMins}m left`;
  }

  return 'Less than a minute left';
}
