import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check } from 'lucide-react';

const FNDRY_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

const XIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.629zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export function Footer() {
  const [copied, setCopied] = useState(false);

  const copyCA = () => {
    navigator.clipboard.writeText(FNDRY_CA).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <footer className="relative mt-24 border-t border-border bg-forge-950">
      {/* Magenta accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-footer opacity-50" />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Col 1: Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo-icon.png" alt="SolFoundry" className="w-6 h-6" />
              <span className="font-display text-lg font-semibold text-text-primary">SolFoundry</span>
            </div>
            <p className="text-sm text-text-secondary max-w-xs leading-relaxed">
              The AI-powered bounty forge on Solana. Fund bounties, ship code, earn rewards.
            </p>
          </div>

          {/* Col 2: Platform */}
          <div>
            <h4 className="font-sans text-sm font-semibold text-text-primary mb-4">Platform</h4>
            <ul className="space-y-2">
              {[
                { label: 'Bounties', to: '/bounties' },
                { label: 'Leaderboard', to: '/leaderboard' },
                { label: 'How It Works', to: '/how-it-works' },
                { label: 'Post a Bounty', to: '/bounties/create' },
              ].map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="text-sm text-text-muted hover:text-text-secondary transition-colors duration-150">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Social */}
          <div>
            <h4 className="font-sans text-sm font-semibold text-text-primary mb-4">Social</h4>
            <div className="flex flex-col gap-3">
              <a
                href="https://x.com/foundrysol"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                <XIcon />
                <span className="text-sm">@foundrysol</span>
              </a>
              <a
                href="https://github.com/SolFoundry"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                <GitHubIcon />
                <span className="text-sm">GitHub</span>
              </a>
            </div>
          </div>

          {/* Col 4: Token */}
          <div>
            <h4 className="font-sans text-sm font-semibold text-text-primary mb-4">$FNDRY Token</h4>
            <p className="text-sm text-text-muted mb-3">Contract Address:</p>
            <div className="font-mono text-xs text-text-muted bg-forge-800 rounded px-3 py-2 inline-flex items-center gap-2 min-w-0">
              <span className="truncate">{FNDRY_CA.slice(0, 8)}...{FNDRY_CA.slice(-4)}</span>
              <button
                onClick={copyCA}
                className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors duration-150"
                title="Copy contract address"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/50 text-center text-xs text-text-muted">
          &copy; 2026 SolFoundry. Built on Solana.
        </div>
      </div>
    </footer>
  );
}
