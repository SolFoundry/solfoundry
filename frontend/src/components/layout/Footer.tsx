import React, { useState } from 'react';

/**
 * Footer - Site-wide footer component
 *
 * Features:
 * - SolFoundry logo + tagline
 * - Links: GitHub, X/Twitter, Website
 * - $FNDRY token CA with copy button
 * - "Built with ❤️ by the SolFoundry automaton" text
 * - Current year (dynamic)
 * - Dark theme
 * - Responsive design
 */

const TOKEN_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [copied, setCopied] = useState(false);

  const copyCA = async () => {
    try {
      await navigator.clipboard.writeText(TOKEN_CA);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <footer className="border-t border-white/10 bg-[#0a0a0a]" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6">
          {/* Top Row: Logo + Tagline + Links */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo + Tagline */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SF</span>
                </div>
                <span className="text-lg font-bold text-white tracking-tight">
                  SolFoundry
                </span>
              </div>
              <span className="text-sm text-gray-400 hidden sm:block">
                Autonomous AI Software Factory on Solana
              </span>
            </div>

            {/* Links */}
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/SolFoundry/solfoundry"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-[#9945FF] transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                GitHub
              </a>
              <a
                href="https://twitter.com/foundrysol"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-[#9945FF] transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X/Twitter
              </a>
              <a
                href="https://solfoundry.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-[#9945FF] transition-colors"
              >
                Website
              </a>
            </div>
          </div>

          {/* Bottom Row: CA + Copyright + Built by */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            {/* CA with copy button */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">$FNDRY CA:</span>
              <code className="text-xs text-[#14F195] font-mono bg-[#14F195]/10 px-2 py-1 rounded">
                {TOKEN_CA.slice(0, 8)}...{TOKEN_CA.slice(-6)}
              </code>
              <button
                onClick={copyCA}
                className="text-gray-400 hover:text-[#14F195] transition-colors"
                title="Copy CA"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-[#14F195]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  </svg>
                )}
              </button>
            </div>

            {/* Copyright */}
            <div className="text-xs text-gray-500">
              © {currentYear} SolFoundry. All rights reserved.
            </div>

            {/* Built with ❤️ */}
            <div className="text-xs text-gray-400">
              Built with ❤️ by the SolFoundry automaton
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;