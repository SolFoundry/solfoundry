/**
 * WalletAddress — Displays a Solana wallet address with a copy-to-clipboard button.
 *
 * Features:
 * - Truncated display (e.g. "7xKX...AsU") or full address
 * - Clipboard icon that switches to ✓ checkmark for 2 s after copy
 * - "Copy address" tooltip on hover
 * - Mono font, green accent text
 * - Zero external dependencies (uses navigator.clipboard.writeText)
 *
 * @example
 *   <WalletAddress address="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" truncate />
 *   <WalletAddress address={pubkey} truncate={false} className="text-xs" />
 *
 * @module WalletAddress
 */
import { useState, useCallback, useRef } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WalletAddressProps {
  /** Full Solana wallet / public key address */
  address: string;
  /** If true, display "XXXX...XXXX" (first 4 + last 4 chars). Default: true */
  truncate?: boolean;
  /** Additional class names applied to the root element */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ─── Icon components ─────────────────────────────────────────────────────────

function ClipboardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <rect x="9" y="2" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-green-400"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * WalletAddress renders a wallet address string alongside a copy-to-clipboard button.
 */
export function WalletAddress({
  address,
  truncate = true,
  className = '',
}: WalletAddressProps) {
  const [copied, setCopied] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);

      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
      resetTimer.current = setTimeout(() => {
        setCopied(false);
        resetTimer.current = null;
      }, 2000);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const textarea = document.createElement('textarea');
      textarea.value = address;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      setCopied(true);
      resetTimer.current = setTimeout(() => {
        setCopied(false);
        resetTimer.current = null;
      }, 2000);
    }
  }, [address]);

  const displayAddress = truncate ? truncateAddress(address) : address;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono ${className}`}
    >
      {/* Address text */}
      <span
        className="text-[#22c55e] select-all"
        title={truncate ? address : undefined}
      >
        {displayAddress}
      </span>

      {/* Copy button + tooltip wrapper */}
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={handleCopy}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
          onFocus={() => setTooltipVisible(true)}
          onBlur={() => setTooltipVisible(false)}
          aria-label={copied ? 'Address copied' : 'Copy address'}
          className={`
            inline-flex items-center justify-center
            p-1 rounded
            transition-colors duration-150
            ${copied
              ? 'text-green-400 bg-green-500/10'
              : 'text-gray-400 hover:text-[#22c55e] hover:bg-[#22c55e]/10'
            }
          `}
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </button>

        {/* Tooltip */}
        {tooltipVisible && !copied && (
          <span
            role="tooltip"
            className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-2
              px-2 py-1 rounded
              text-xs text-white whitespace-nowrap
              bg-gray-700 border border-white/10 shadow-lg
              pointer-events-none
              animate-fade-in
            "
          >
            Copy address
            {/* Arrow */}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
          </span>
        )}

        {/* "Copied!" tooltip */}
        {copied && (
          <span
            role="status"
            aria-live="polite"
            className="
              absolute bottom-full left-1/2 -translate-x-1/2 mb-2
              px-2 py-1 rounded
              text-xs text-green-400 whitespace-nowrap
              bg-gray-700 border border-green-500/30 shadow-lg
              pointer-events-none
            "
          >
            Copied!
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
          </span>
        )}
      </span>
    </span>
  );
}

export default WalletAddress;
