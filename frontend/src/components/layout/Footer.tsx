/**
 * Footer — Enhanced site-wide footer for SolFoundry.
 *
 * Renders on every page via SiteLayout. Contains:
 * - Sections: About, Resources, Community, Legal
 * - Social links: X/Twitter, GitHub, Discord
 * - Navigation links: Bounties, Leaderboard, How It Works, Docs
 * - $FNDRY token contract address with copy-to-clipboard
 * - Copyright notice with current year
 * - Responsive: stacks on mobile, grid on desktop
 * - Dark/light theme support
 *
 * @module components/layout/Footer
 */
import React, { useState, useRef, useEffect } from 'react';
import { FNDRY_TOKEN_CA } from '../../config/constants';
import { useTheme } from '../../contexts/ThemeContext';

// ============================================================================
// Footer Link Sections
// ============================================================================

const FOOTER_SECTIONS = {
  about: {
    title: 'About',
    links: [
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Leaderboard', href: '/leaderboard' },
      { label: 'Agents', href: '/agents' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Bounties', href: '/bounties' },
      { label: 'Documentation', href: 'https://github.com/SolFoundry/solfoundry#readme', external: true },
      { label: 'GitHub', href: 'https://github.com/SolFoundry/solfoundry', external: true },
    ],
  },
  community: {
    title: 'Community',
    links: [
      { label: 'X / Twitter', href: 'https://twitter.com/foundrysol', external: true },
      { label: 'Discord', href: 'https://discord.gg/solfoundry', external: true },
      { label: 'Website', href: 'https://solfoundry.org', external: true },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
    ],
  },
};

// ============================================================================
// Social Icons
// ============================================================================

const SOCIAL_LINKS = [
  {
    label: 'X / Twitter',
    href: 'https://twitter.com/foundrysol',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/SolFoundry/solfoundry',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/solfoundry',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
];

// ============================================================================
// Footer Component
// ============================================================================

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { theme } = useTheme?.() || { theme: 'dark' };

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

  const isDark = theme === 'dark';

  return (
    <footer
      className={`border-t font-mono transition-colors duration-200 ${
        isDark
          ? 'border-white/10 bg-[#0a0a0a] text-white'
          : 'border-gray-200 bg-white text-gray-900'
      }`}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content - Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">SF</span>
              </div>
              <span className="text-lg font-bold tracking-tight">SolFoundry</span>
            </div>
            <p
              className={`text-sm mb-4 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              Autonomous AI Software Factory on Solana
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className={`transition-colors ${
                    isDark
                      ? 'text-gray-400 hover:text-[#9945FF]'
                      : 'text-gray-500 hover:text-[#9945FF]'
                  }`}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link Sections */}
          {Object.entries(FOOTER_SECTIONS).map(([key, section]) => (
            <div key={key}>
              <h3
                className={`font-semibold text-sm mb-3 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      className={`text-sm transition-colors ${
                        isDark
                          ? 'text-gray-400 hover:text-[#9945FF]'
                          : 'text-gray-600 hover:text-[#9945FF]'
                      }`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Token Contract Address */}
        <div
          className={`mt-10 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDark ? 'border-white/10' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-xs shrink-0 ${
                isDark ? 'text-gray-500' : 'text-gray-500'
              }`}
            >
              $FNDRY Token:
            </span>
            <code
              className={`text-xs font-mono px-2 py-1 rounded truncate max-w-[140px] sm:max-w-[200px] ${
                isDark
                  ? 'text-[#14F195] bg-[#14F195]/10'
                  : 'text-green-600 bg-green-50'
              }`}
            >
              {FNDRY_TOKEN_CA}
            </code>
            <button
              onClick={handleCopy}
              aria-label={copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy contract address'}
              title={copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy CA'}
              className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded border transition-colors ${
                copyFailed
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : copied
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : isDark
                  ? 'bg-white/5 hover:bg-[#14F195]/20 border-white/10 text-gray-400 hover:text-[#14F195]'
                  : 'bg-gray-100 hover:bg-green-100 border-gray-200 text-gray-500 hover:text-green-600'
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

          {/* Copyright */}
          <div
            className={`text-xs text-center sm:text-right ${
              isDark ? 'text-gray-600' : 'text-gray-500'
            }`}
          >
            <p>© {currentYear} SolFoundry. All rights reserved.</p>
            <p className="mt-1">Built with 🔥 by the SolFoundry automaton</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
