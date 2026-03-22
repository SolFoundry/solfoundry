/**
 * CopyAddress - Reusable component for copying wallet addresses to clipboard
 * 
 * Displays truncated address with click-to-copy functionality
 * Shows visual feedback (checkmark) for 2 seconds after copy
 * Accessible with keyboard support and screen reader announcements
 * 
 * @module components/common/CopyAddress
 */
import { useState, useCallback } from 'react';

export interface CopyAddressProps {
  /** Full address to display and copy */
  address: string;
  /** Optional CSS class for styling */
  className?: string;
  /** Number of characters to show at start (default: 4) */
  startChars?: number;
  /** Number of characters to show at end (default: 4) */
  endChars?: number;
}

/**
 * Truncates an address for display
 * Example: "C2Tv...BAGS"
 */
export function truncateAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (!address || address.length <= startChars + endChars + 3) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * CopyAddress component - Click to copy wallet address
 * 
 * @example
 * <CopyAddress address="C2Tv...BAGS" />
 * <CopyAddress address={walletAddress} startChars={6} endChars={6} />
 */
export function CopyAddress({
  address,
  className = '',
  startChars = 4,
  endChars = 4,
}: CopyAddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!address || copied) return;

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      
      // Reset after 2 seconds
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [address, copied]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleCopy();
      }
    },
    [handleCopy]
  );

  const truncated = truncateAddress(address, startChars, endChars);

  return (
    <button
      type="button"
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      className={`
        inline-flex items-center gap-1.5 
        px-2 py-1 rounded-md 
        bg-surface-100 hover:bg-surface-200 
        border border-gray-700 hover:border-gray-600
        text-gray-300 hover:text-white
        transition-all duration-200
        cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-[#9945FF] focus:ring-offset-1 focus:ring-offset-surface
        ${className}
      `}
      title={address}
      aria-label={copied ? 'Address copied to clipboard' : `Copy address ${truncated}`}
      aria-live="polite"
    >
      <span className="font-mono text-sm">{truncated}</span>
      
      {copied ? (
        <svg 
          className="w-4 h-4 text-[#00FF88]" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M5 13l4 4L19 7" 
          />
        </svg>
      ) : (
        <svg 
          className="w-4 h-4 text-gray-500 hover:text-gray-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" 
          />
        </svg>
      )}
      
      {/* Screen reader only text */}
      <span className="sr-only">
        {copied ? 'Copied!' : 'Click to copy full address'}
      </span>
    </button>
  );
}

export default CopyAddress;
