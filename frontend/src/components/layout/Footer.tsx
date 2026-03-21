/**
 * Footer component for SolFoundry platform.
 * 
 * Features:
 * - SolFoundry logo with tagline
 * - Social links (GitHub, X/Twitter, Website)
 * - $FNDRY token CA with copy-to-clipboard
 * - "Built with 🔥 by the SolFoundry automaton" text
 * - Responsive design (stacks vertically on mobile)
 * - Dark theme consistent with site design
 */
import { useState, useCallback, useEffect } from 'react';

// $FNDRY token contract address
const FNDRY_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjgjWmpaGnT74VBAGS';

// Footer links configuration
const FOOTER_LINKS = [
  { label: 'GitHub', href: 'https://github.com/SolFoundry/solfoundry' },
  { label: 'X/Twitter', href: 'https://x.com/foundrysol' },
  { label: 'Website', href: 'https://solfoundry.org' },
];

/**
 * Copy text to clipboard with fallback for older browsers.
 */
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

/**
 * Footer component for site-wide use.
 * 
 * @example
 * ```tsx
 * <Footer />
 * ```
 */
export function Footer() {
  const currentYear = new Date().getFullYear();
  const [copied, setCopied] = useState(false);

  const handleCopyCA = useCallback(async () => {
    if (copied) return;
    const success = await copyToClipboard(FNDRY_CA);
    if (success) {
      setCopied(true);
    }
  }, [copied]);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <footer
      className="border-t border-white/10 bg-surface"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main content - stacks vertically on mobile */}
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between md:gap-4">
          
          {/* Left: Logo + Tagline */}
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2">
              {/* SolFoundry Logo */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center">
                <span className="text-white font-bold text-xs">SF</span>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                SolFoundry
              </span>
            </div>
            <p className="text-sm text-gray-400 text-center md:text-left">
              Decentralized bounty platform for Solana
            </p>
          </div>

          {/* Center: Social Links */}
          <nav className="flex items-center gap-6" aria-label="Footer navigation">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-solana-purple transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right: Token CA with copy button */}
          <div className="flex flex-col items-center md:items-end gap-1">
            <span className="text-xs text-gray-500">$FNDRY Token CA</span>
            <div className="flex items-center gap-2">
              <code className="text-xs text-solana-green font-mono bg-solana-green/10 px-2 py-1 rounded max-w-[200px] truncate">
                {FNDRY_CA}
              </code>
              <button
                type="button"
                onClick={handleCopyCA}
                aria-label={copied ? 'Copied!' : 'Copy contract address'}
                className={`h-6 w-6 rounded inline-flex items-center justify-center transition-colors ${
                  copied
                    ? 'text-solana-green'
                    : 'text-gray-400 hover:text-solana-green'
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
            </div>
            {copied && (
              <span className="text-xs text-solana-green animate-pulse" role="status" aria-live="polite">
                Copied!
              </span>
            )}
          </div>
        </div>

        {/* Bottom: Built by + Copyright */}
        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            Built with 🔥 by the SolFoundry automaton
          </p>
          <p className="text-sm text-gray-500">
            © {currentYear} SolFoundry. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;