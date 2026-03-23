/** SolFoundry wallet address component with copy-to-clipboard functionality. */
import { useState, useCallback, useEffect } from 'react';

/** Props for the WalletAddress component. */
export interface WalletAddressProps {
  /** The wallet address or any string to display and copy. */
  address: string;
  /** Number of characters to show at the start. Default: 4 */
  startChars?: number;
  /** Number of characters to show at the end. Default: 4 */
  endChars?: number;
  /** Custom class name for styling. */
  className?: string;
  /** Whether to show the copy button. Default: true */
  showCopyButton?: boolean;
  /** Whether to show the full address on hover. Default: true */
  showTooltip?: boolean;
}

/** Truncate a string for display. */
export function truncateString(str: string, startChars = 4, endChars = 4): string {
  if (!str || str.length <= startChars + endChars + 3) return str;
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

/** Copy text to clipboard with fallback. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

/** Reusable wallet address component with copy-to-clipboard functionality. */
export function WalletAddress({
  address,
  startChars = 4,
  endChars = 4,
  className = '',
  showCopyButton = true,
  showTooltip = true,
}: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const truncated = truncateString(address, startChars, endChars);
  const isTruncated = address !== truncated;

  const handleCopy = useCallback(async () => {
    if (!address || copied) return;
    const success = await copyToClipboard(address);
    if (success) {
      setCopied(true);
    }
  }, [address, copied]);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!address) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-surface-100 px-2 py-1 ${className}`}>
      <span
        className="font-mono text-sm text-gray-300"
        title={showTooltip && isTruncated ? address : undefined}
        aria-label={`Address: ${address}`}
      >
        {truncated}
      </span>
      {showCopyButton && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
          className={`h-6 w-6 rounded inline-flex items-center justify-center transition-colors ${
            copied
              ? 'text-solana-mint'
              : 'text-gray-400 hover:text-solana-mint'
          }`}
        >
          {copied ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
          )}
        </button>
      )}
      {copied && (
        <span className="text-xs text-solana-mint animate-pulse" role="status" aria-live="polite">
          Copied!
        </span>
      )}
    </div>
  );
}// Generated: 2026-03-23T18:07:00Z
