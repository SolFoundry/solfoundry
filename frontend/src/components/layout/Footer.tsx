import React, { useState, useRef, useEffect } from 'react';
import { FNDRY_TOKEN_CA } from '../../config/constants';

const FOOTER_LINKS = [
  { label: 'GitHub', href: 'https://github.com/SolFoundry/solfoundry' },
  { label: 'X / Twitter', href: 'https://twitter.com/foundrysol' },
  { label: 'Website', href: 'https://solfoundry.org' },
];

// ============================================================================
// Footer Component
// ============================================================================

/**
 * Footer — Site-wide footer for SolFoundry.
 *
 * Renders on every page via SiteLayout. Contains:
 * - Logo + tagline
 * - External links (GitHub, X/Twitter, Website)
 * - $FNDRY token contract address with copy-to-clipboard
 * - "Built with 🔥 by the SolFoundry automaton" attribution
 * - Current year (dynamic)
 * - Responsive: stacks vertically on mobile
 */
export function Footer() {
  const currentYear = new Date().getFullYear();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(FNDRY_TOKEN_CA);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = FNDRY_TOKEN_CA;
        document.body.appendChild(el);
        el.select();
        const success = document.execCommand('copy');
        document.body.removeChild(el);
        if (success) {
          setCopied(true);
          timerRef.current = setTimeout(() => setCopied(false), 2000);
        } else {
          setCopyFailed(true);
          timerRef.current = setTimeout(() => setCopyFailed(false), 3000);
        }
      } catch {
        setCopyFailed(true);
        timerRef.current = setTimeout(() => setCopyFailed(false), 3000);
      }
    }
  };

  return (
    <footer
      className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-surface font-mono"
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top row: logo + links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="flex flex-col items-center md:items-start gap-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xs">SF</span>
              </div>
              <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                SolFoundry
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Autonomous AI Software Factory on Solana
            </p>
          </div>

          {/* External links */}
          <nav
            className="flex flex-wrap items-center justify-center gap-5"
            aria-label="Footer navigation"
          >
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-[#9945FF] dark:text-gray-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* $FNDRY token CA + copy button */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 shrink-0">$FNDRY CA:</span>
            <code className="text-xs text-[#14F195] font-mono bg-[#14F195]/10 px-2 py-1 rounded truncate max-w-[120px] sm:max-w-none">
              {FNDRY_TOKEN_CA}
            </code>
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy contract address'}
              title={copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy CA'}
              className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded
                         border transition-colors
                         ${copyFailed
                           ? 'bg-red-500/10 border-red-500/30 text-red-400'
                           : 'bg-gray-100 hover:bg-[#14F195]/20 border-gray-200 text-gray-500 hover:text-[#14F195] dark:bg-white/5 dark:border-white/10 dark:text-gray-400'
                         }`}
            >
              {copyFailed ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : copied ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Bottom row: copyright + attribution */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-600">
          <span>© {currentYear} SolFoundry. All rights reserved.</span>
          <span>Built with 🔥 by the SolFoundry automaton</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
