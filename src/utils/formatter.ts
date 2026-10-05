const currencyFormatters = new Map<number, Intl.NumberFormat>();
const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

/**
 * Returns a cached USD formatter for the requested decimal precision.
 */
function getCurrencyFormatter(digits: number): Intl.NumberFormat {
  let formatter = currencyFormatters.get(digits);

  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    });
    currencyFormatters.set(digits, formatter);
  }

  return formatter;
}

/**
 * Formats token prices as USD while preserving extra precision for sub-cent values.
 */
export function formatCurrency(value: number | null | undefined, maximumFractionDigits = 6): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }

  const absoluteValue = Math.abs(value);
  const digits =
    absoluteValue >= 1 ? 2 :
    absoluteValue >= 0.01 ? 4 :
    Math.max(2, maximumFractionDigits);

  return getCurrencyFormatter(digits).format(value);
}

/**
 * Formats large market values with compact notation for dashboard display.
 */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }

  return compactNumberFormatter.format(value);
}

/**
 * Formats a percentage change with an explicit positive sign.
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

/**
 * Describes how recently the live price data was refreshed.
 */
export function formatRelativeUpdate(timestamp: number | null | undefined): string {
  if (timestamp == null) {
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
