import React, { useState, useCallback } from 'react';

interface CopyAddressProps {
  address: string;
  truncatedLength?: number;
  className?: string;
  tooltipText?: string;
}

/**
 * CopyAddress Component
 * 
 * A reusable component for displaying wallet addresses and transaction hashes
 * with click-to-copy functionality and visual feedback.
 * 
 * Features:
 * - Truncated display (e.g., C2Tv...BAGS)
 * - Full address on hover tooltip
 * - Click to copy to clipboard
 * - Visual feedback with checkmark icon
 * - Keyboard accessible
 * - Screen reader friendly
 */
export const CopyAddress: React.FC<CopyAddressProps> = ({
  address,
  truncatedLength = 4,
  className = '',
  tooltipText = 'Click to copy',
}) => {
  const [copied, setCopied] = useState(false);

  const truncateAddress = useCallback((addr: string, length: number) => {
    if (addr.length <= length * 2) return addr;
    return `${addr.slice(0, length)}...${addr.slice(-length)}`;
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      
      // Announce to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.className = 'sr-only';
      announcement.textContent = 'Address copied to clipboard';
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  }, [address]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCopy();
    }
  }, [handleCopy]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 cursor-pointer group relative ${className}`}
      onClick={handleCopy}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Copy address ${address} to clipboard`}
      title={tooltipText}
    >
      <span className="font-mono text-sm">
        {truncateAddress(address, truncatedLength)}
      </span>
      
      {/* Copy Icon / Checkmark */}
      <span className="flex items-center justify-center w-4 h-4 transition-all duration-200">
        {copied ? (
          <svg
            className="w-4 h-4 text-green-500"
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
            className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
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
      </span>

      {/* Full Address Tooltip */}
      <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {address}
        <span className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </span>
    </span>
  );
};

export default CopyAddress;
