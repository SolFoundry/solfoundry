export function formatCurrency(value: number | null | undefined, maximumFractionDigits = 6): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  const digits =
    value >= 1 ? 2 :
    value >= 0.01 ? 4 :
    maximumFractionDigits;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercentage(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '--';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatRelativeUpdate(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'Waiting for live data';
  }

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (seconds < 5) {
    return 'Updated just now';
  }

  if (seconds < 60) {
    return `Updated ${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  return `Updated ${minutes}m ago`;
}
