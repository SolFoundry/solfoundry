/**
 * CopyAddress Component
 * Reusable component for displaying and copying wallet/contract addresses
 */
import { useState, useCallback } from 'react';

export interface CopyAddressProps {
  /** Full address to display and copy */
  address: string;
  /** Number of characters to show at start (default: 4) */
  startChars?: number;
  /** Number of characters to show at end (default: 4) */
  endChars?: number;
  /** Custom className for styling */
  className?: string;
  /** Whether to show copy icon (default: true) */
  showIcon?: boolean;
  /** Custom label for screen readers */
  ariaLabel?: string;
  /** Callback after successful copy */
  onCopy?: () => void;
  /** Test id for testing */
  'data-testid'?: string;
}

/**
 * Truncates an address for display (e.g., "C2Tv...BAGS")
 */
export function truncateAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (!address || address.length <= startChars + endChars + 3) {
    return address || '';
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * CopyAddress component - displays truncated address with copy functionality
 */
export function CopyAddress({
  address,
  startChars = 4,
  endChars = 4,
  className = '',
  showIcon = true,
  ariaLabel,
  onCopy,
  'data-testid': dataTestId = 'copy-address',
}: CopyAddressProps): JSX.Element | null {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const truncatedAddress = truncateAddress(address, startChars, endChars);
  const displayLabel = ariaLabel || `Copy ${truncatedAddress} to clipboard`;

  const handleCopy = useCallback(async () => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setCopyError(false);
      onCopy?.();

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setCopyError(true);
      // Reset error state after 2 seconds
      setTimeout(() => setCopyError(false), 2000);
    }
  }, [address, onCopy]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCopy();
      }
    },
    [handleCopy]
  );

  if (!address) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono ${className}`}
      data-testid={dataTestId}
    >
      {/* Truncated address with full address as tooltip */}
      <span
        className="text-gray-300 cursor-default"
        title={address}
        data-testid={`${dataTestId}-text`}
      >
        {truncatedAddress}
      </span>

      {/* Copy button */}
      {showIcon && (
        <button
          type="button"
          onClick={handleCopy}
          onKeyDown={handleKeyDown}
          className="text-gray-500 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 rounded p-0.5 transition-colors"
          aria-label={displayLabel}
          title={copied ? 'Copied!' : copyError ? 'Failed to copy' : 'Copy to clipboard'}
          data-testid={`${dataTestId}-btn`}
        >
          {copied ? (
            // Checkmark icon - success state
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              data-testid={`${dataTestId}-checkmark`}
            >
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          ) : copyError ? (
            // X icon - error state
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              data-testid={`${dataTestId}-error`}
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            // Copy icon - default state
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
              data-testid={`${dataTestId}-icon`}
            >
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
          )}
        </button>
      )}

      {/* Screen reader announcement */}
      <span className="sr-only" role="status" aria-live="polite" data-testid={`${dataTestId}-status`}>
        {copied ? 'Address copied to clipboard' : copyError ? 'Failed to copy address' : ''}
      </span>
    </span>
  );
}
