import React, { useState, useEffect, useCallback } from 'react';
import OnboardingWizard from '../OnboardingWizard';

// ============================================================================
// Types
// ============================================================================

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

export interface SiteLayoutProps {
  children: React.ReactNode;
  currentPath?: string;
  walletAddress?: string | null;
  onConnectWallet?: () => void;
  onDisconnectWallet?: () => void;
  avatarUrl?: string;
  userName?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const NAV_LINKS: NavLink[] = [
  { label: 'Bounties', href: '/bounties' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Agents', href: '/agents' },
  { label: 'Docs', href: 'https://github.com/SolFoundry/solfoundry#readme', external: true },
];

const FOOTER_LINKS = [
  { label: 'GitHub', href: 'https://github.com/SolFoundry/solfoundry' },
  { label: 'Twitter', href: 'https://twitter.com/foundrysol' },
  { label: 'Docs', href: 'https://github.com/SolFoundry/solfoundry#readme' },
  { label: 'CA', href: 'https://solscan.io/token/C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS' },
];

const WALLET_ADDRESS = 'Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7';

// ============================================================================
// Components
// ============================================================================

/**
 * SiteLayout - Main layout component for SolFoundry public site
 * 
 * Features:
 * - Responsive header with logo, navigation, wallet connect, and user menu
 * - Mobile sidebar with hamburger menu
 * - Footer with links and copyright
 * - Dark theme with Solana-inspired colors
 * - Current navigation item highlighting
 * - SF Mono monospace font
 */
export function SiteLayout({
  children,
  currentPath = '/',
  walletAddress,
  onConnectWallet,
  onDisconnectWallet,
  avatarUrl,
  userName,
  theme = 'dark',
  onToggleTheme,
}: SiteLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status on mount
  useEffect(() => {
    const onboarded = localStorage.getItem('sf_onboarded');
    if (!onboarded) {
      // Small delay to let the initial page load feel smooth
      const timer = setTimeout(() => setShowOnboarding(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Handle scroll for header background
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleNavClick = useCallback((href: string) => {
    setMobileMenuOpen(false);
    // For Next.js, navigation would be handled by Link component
  }, []);

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <div className="site-layout min-h-screen bg-[#0a0a0a] font-mono text-white">
      {/* Header */}
      <Header
        currentPath={currentPath}
        walletAddress={walletAddress}
        onConnectWallet={onConnectWallet}
        scrolled={scrolled}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        userMenuOpen={userMenuOpen}
        onToggleUserMenu={() => setUserMenuOpen(!userMenuOpen)}
        onDisconnectWallet={onDisconnectWallet}
        avatarUrl={avatarUrl}
        userName={userName}
        onNavClick={handleNavClick}
        truncateAddress={truncateAddress}
        onShowOnboarding={() => setShowOnboarding(true)}
        theme={theme}
        onToggleTheme={onToggleTheme}
      />

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile/Tablet Sidebar */}
      <Sidebar
        isOpen={mobileMenuOpen}
        currentPath={currentPath}
        onNavClick={handleNavClick}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Main Content */}
      <main className="min-h-screen pt-16">
        {children}
      </main>

      {/* Footer */}
      <Footer />

      {/* Onboarding Wizard */}
      <OnboardingWizard
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={() => setShowOnboarding(false)}
      />
    </div>
  );
}

// ============================================================================
// Header Component
// ============================================================================

interface HeaderProps {
  currentPath: string;
  walletAddress?: string | null;
  onConnectWallet?: () => void;
  scrolled: boolean;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  userMenuOpen: boolean;
  onToggleUserMenu: () => void;
  onDisconnectWallet?: () => void;
  avatarUrl?: string;
  userName?: string;
  onNavClick: (href: string) => void;
  truncateAddress: (address: string) => string;
  onShowOnboarding?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

function Header({
  currentPath,
  walletAddress,
  onConnectWallet,
  scrolled,
  mobileMenuOpen,
  onToggleMobileMenu,
  userMenuOpen,
  onToggleUserMenu,
  onDisconnectWallet,
  avatarUrl,
  userName,
  onNavClick,
  truncateAddress,
  onShowOnboarding,
  theme = 'dark',
  onToggleTheme,
}: HeaderProps) {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-16 transition-colors duration-200
                  ${scrolled 
                    ? 'bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10' 
                    : 'bg-transparent'}`}
      role="banner"
    >
      <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Logo + Desktop Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <span className="text-white font-bold text-sm">SF</span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight hidden sm:block group-hover:text-[#9945FF] transition-colors">
              SolFoundry
            </span>
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1" role="navigation" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={link.external ? undefined : () => onNavClick(link.href)}
                target={link.external ? '_blank' : undefined}
                rel={link.external ? 'noopener noreferrer' : undefined}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${!link.external && (currentPath === link.href || currentPath.startsWith(link.href + '/'))
                    ? 'text-[#14F195] bg-[#14F195]/10'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                aria-current={!link.external && currentPath === link.href ? 'page' : undefined}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={onShowOnboarding}
              className="px-4 py-2 rounded-lg text-sm font-bold text-[#14F195] hover:bg-[#14F195]/10 bg-[#14F195]/5 transition-all ml-4 border border-[#14F195]/20"
            >
              Get Started
            </button>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Wallet Connect Button */}
          {walletAddress ? (
            <div className="relative">
              <button
                onClick={onToggleUserMenu}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#14F195]/10 border border-[#14F195]/30
                         text-[#14F195] text-sm font-medium hover:bg-[#14F195]/20 transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={userName || 'User'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-xs font-bold">{userName?.[0]?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <span className="hidden sm:block">{truncateAddress(walletAddress)}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {/* User Dropdown Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 shadow-xl">
                  <div className="px-4 py-2 border-b border-white/10">
                    <p className="text-sm font-medium text-white">{userName || 'User'}</p>
                    <p className="text-xs text-gray-400 font-mono">{truncateAddress(walletAddress)}</p>
                  </div>
                  <a href="/creator" className="block px-4 py-2 text-sm text-[#14F195] hover:bg-white/5 hover:text-[#14F195]">
                    Creator Dashboard
                  </a>
                  <a href="/dashboard" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">
                    Contributor Dashboard
                  </a>
                  <a href="/profile" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">
                    Profile
                  </a>
                  <a href="/settings" className="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white">
                    Settings
                  </a>
                  <button
                    onClick={onDisconnectWallet}
                    className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5 hover:text-red-300"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onConnectWallet}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195]
                       text-white text-sm font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#9945FF]/20"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
              <span>Connect Wallet</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg
                     text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white 
                     hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg
                     text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white 
                     hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// Sidebar Component
// ============================================================================

interface SidebarProps {
  isOpen: boolean;
  currentPath: string;
  onNavClick: (href: string) => void;
  onClose: () => void;
}

function Sidebar({ isOpen, currentPath, onNavClick, onClose }: SidebarProps) {
  return (
    <aside
      className={`fixed top-16 left-0 bottom-0 w-64 z-50 bg-[#0a0a0a] border-r border-white/10
                transform transition-transform duration-300 ease-in-out lg:hidden
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      role="navigation"
      aria-label="Mobile navigation"
      aria-hidden={!isOpen}
    >
      <nav className="p-4 space-y-1">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={link.external ? undefined : () => onNavClick(link.href)}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noopener noreferrer' : undefined}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
              ${!link.external && (currentPath === link.href || currentPath.startsWith(link.href + '/'))
                ? 'text-[#14F195] bg-[#14F195]/10'
                : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            aria-current={!link.external && currentPath === link.href ? 'page' : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
        <p className="text-xs text-gray-500 text-center font-mono">
          SolFoundry v0.1.0
        </p>
      </div>
    </aside>
  );
}

// ============================================================================
// Footer Component
// ============================================================================

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#0a0a0a]" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo + Copyright */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
              <span className="text-white font-bold text-xs">SF</span>
            </div>
            <span className="text-sm text-gray-400">
              © {currentYear} SolFoundry. All rights reserved.
            </span>
          </div>

          {/* Footer Links */}
          <div className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.href + link.label}
                href={link.href}
                target={link.href.startsWith('http') ? '_blank' : undefined}
                rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-sm text-gray-400 hover:text-[#9945FF] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Contract Address */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">CA:</span>
            <code className="text-xs text-[#14F195] font-mono bg-[#14F195]/10 px-2 py-1 rounded">
              {WALLET_ADDRESS}
            </code>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteLayout;