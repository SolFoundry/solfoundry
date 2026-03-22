import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FNDRY_TOKEN_CA } from '../../config/constants';
import { SolFoundryLogoMark } from '../common/SolFoundryLogoMark';

const GITHUB_REPO = 'https://github.com/SolFoundry/solfoundry';
const DOCS_HREF = `${GITHUB_REPO}#readme`;
/** Bounty spec: @SolFoundry */
const X_HREF = 'https://x.com/SolFoundry';

const footerLinkClass =
  'text-sm text-gray-600 dark:text-gray-400 hover:text-solana-purple dark:hover:text-solana-green transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solana-purple/40 rounded';

// ============================================================================
// Footer Component
// ============================================================================

/**
 * Site-wide footer: SolFoundry branding, sectioned links (About, Resources,
 * Community, Legal), social icons, $FNDRY contract copy, and copyright.
 * Responsive: stacked on small screens, multi-column grid from `lg` up.
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
        {/* Brand + socials */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-8 pb-10 border-b border-gray-200 dark:border-white/10">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left gap-1">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solana-purple/40"
            >
              <SolFoundryLogoMark size="sm" className="shadow-sm shadow-solana-purple/10" />
              <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">
                SolFoundry
              </span>
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
              Autonomous AI software factory on Solana — ship bounties, earn $FNDRY, and grow with the
              community.
            </p>
          </div>

          <nav
            className="flex items-center justify-center lg:justify-end gap-2"
            aria-label="Social media"
          >
            <a
              href={X_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10
                         bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400
                         hover:text-solana-purple dark:hover:text-solana-green hover:border-solana-purple/30 transition-colors"
              aria-label="X / Twitter (@SolFoundry)"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 dark:border-white/10
                         bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400
                         hover:text-solana-purple dark:hover:text-solana-green hover:border-solana-purple/30 transition-colors"
              aria-label="GitHub repository"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.463 2 11.97c0 4.404 2.865 8.14 6.839 9.458.5.092.682-.216.682-.48 0-.236-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 11.969C22 6.463 17.522 2 12 2z"
                />
              </svg>
            </a>
          </nav>
        </div>

        {/* Section links — stack on mobile, grid on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 pt-10">
          <nav aria-label="Footer: About" className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              About
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
              Open bounties, AI-assisted reviews, and on-chain escrow for builders on Solana.
            </p>
            <Link to="/how-it-works" className={footerLinkClass}>
              How It Works
            </Link>
            <a
              href="https://solfoundry.org"
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClass}
            >
              Website
            </a>
          </nav>

          <nav aria-label="Footer: Resources" className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              Resources
            </h2>
            <Link to="/bounties" className={footerLinkClass}>
              Bounties
            </Link>
            <a href={DOCS_HREF} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
              Docs
            </a>
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
              GitHub
            </a>
          </nav>

          <nav aria-label="Footer: Community" className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              Community
            </h2>
            <Link to="/leaderboard" className={footerLinkClass}>
              Leaderboard
            </Link>
            <Link to="/agents" className={footerLinkClass}>
              Agents
            </Link>
            <a href={X_HREF} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
              X / Twitter
            </a>
          </nav>

          <nav aria-label="Footer: Legal" className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-900 dark:text-white">
              Legal
            </h2>
            <a
              href={`${GITHUB_REPO}/blob/main/docs/SECURITY.md`}
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClass}
            >
              Security
            </a>
            <a
              href={`${GITHUB_REPO}/blob/main/CONTRIBUTING.md`}
              target="_blank"
              rel="noopener noreferrer"
              className={footerLinkClass}
            >
              Contributing
            </a>
          </nav>
        </div>

        {/* $FNDRY token CA */}
        <div className="mt-10 pt-8 border-t border-gray-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 text-center sm:text-left">
          <span className="text-xs text-gray-500 dark:text-gray-500 shrink-0">$FNDRY CA:</span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <code className="text-xs text-solana-green font-mono bg-solana-green/10 px-2 py-1 rounded truncate max-w-[min(100%,280px)] sm:max-w-none">
              {FNDRY_TOKEN_CA}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy contract address'}
              title={copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy CA'}
              className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border transition-colors
                         ${copyFailed
                           ? 'bg-red-500/10 border-red-500/30 text-red-400'
                           : 'bg-gray-100 dark:bg-white/5 hover:bg-solana-green/20 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-solana-green'
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-600">
          <span>© {currentYear} SolFoundry. All rights reserved.</span>
          <span>Built with 🔥 by the SolFoundry automaton</span>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
