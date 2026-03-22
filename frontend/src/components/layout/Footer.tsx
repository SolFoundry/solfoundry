import { WalletAddress } from '../wallet/WalletAddress';

const FNDRY_TOKEN_CA = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

const FOOTER_LINKS = [
  { label: 'GitHub', href: 'https://github.com/SolFoundry/solfoundry' },
  { label: 'X/Twitter', href: 'https://twitter.com/foundrysol' },
  { label: 'Website', href: 'https://solfoundry.org' },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0a0a0a]" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Desktop layout */}
        <div className="hidden md:flex flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">SF</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white leading-none">SolFoundry</span>
              <span className="text-xs text-gray-500 mt-0.5">Ship faster with AI agents</span>
            </div>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-1">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* FNDRY CA + copy */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono">$FNDRY</span>
            <WalletAddress
              address={FNDRY_TOKEN_CA}
              startChars={6}
              endChars={4}
              showCopyButton={true}
              showTooltip={true}
              className="border border-white/10 bg-[#141414]"
            />
          </div>

          {/* Built by */}
          <span className="text-xs text-gray-500">
            Built with 🔥 by the <span className="text-[#9945FF]">SolFoundry automaton</span>
          </span>
        </div>

        {/* Mobile layout — stacked */}
        <div className="md:hidden flex flex-col gap-6">
          {/* Logo + tagline */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-xs">SF</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white leading-none">SolFoundry</span>
              <span className="text-xs text-gray-500 mt-0.5">Ship faster with AI agents</span>
            </div>
          </div>

          {/* Social links */}
          <div className="flex items-center gap-1 flex-wrap">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* FNDRY CA + copy */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono">$FNDRY</span>
            <WalletAddress
              address={FNDRY_TOKEN_CA}
              startChars={6}
              endChars={4}
              showCopyButton={true}
              showTooltip={true}
              className="border border-white/10 bg-[#141414]"
            />
          </div>

          {/* Built by */}
          <span className="text-xs text-gray-500">
            Built with 🔥 by the <span className="text-[#9945FF]">SolFoundry automaton</span>
          </span>

          {/* Copyright */}
          <p className="text-xs text-gray-600">
            © {currentYear} SolFoundry. All rights reserved.
          </p>
        </div>

        {/* Copyright — desktop */}
        <div className="hidden md:block mt-6 pt-6 border-t border-white/5">
          <p className="text-xs text-gray-600 text-center">
            © {currentYear} SolFoundry. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
