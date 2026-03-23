import React, { useState, useEffect, useCallback } from 'react';
import OnboardingWizard from '../OnboardingWizard';
import { SolFoundryLogoMark } from '../common/SolFoundryLogoMark';
import { LoadingButton } from '../common/LoadingButton';
import { ThemeToggle, SimpleThemeToggle } from './ThemeToggle';
import { Breadcrumbs } from './Breadcrumbs';
import { ScrollToTop } from './ScrollToTop';
import { Footer } from './Footer';

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
  /** Pass true while the wallet adapter is connecting to show a spinner on the button. */
  isConnecting?: boolean;
  avatarUrl?: string;
  userName?: string;
}

// ============================================================================
// Constants
// ============================================================================

const NAV_LINKS: NavLink[] = [
  { label: 'Bounties', href: '/bounties' },
  { label: 'How It Works', href: '/how-it-works' },
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Agents', href: '/agents' },
  { label: 'Docs', href: 'https://github.com/SolFoundry/solfoundry#readme', external: true },
];


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
  isConnecting,
  avatarUrl,
  userName,
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
    <div className="site-layout min-h-screen bg-white dark:bg-surface font-mono text-base text-gray-900 dark:text-white">
      {/* Header */}
      <Header
        currentPath={currentPath}
        walletAddress={walletAddress}
        onConnectWallet={onConnectWallet}
        isConnecting={isConnecting}
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
      />

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden"
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

      {/* Main Content — pt matches header: 4rem + safe-area (notch devices) */}
      <main className="min-h-screen pt-[calc(4rem+env(safe-area-inset-top,0px))]">
        {/* Breadcrumbs — below top nav, above page content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-200 dark:border-white/5">
          <Breadcrumbs />
        </div>
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

      {/* Scroll to Top Button */}
      <ScrollToTop />
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
  isConnecting?: boolean;
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
}

function Header({
  currentPath,
  walletAddress,
  onConnectWallet,
  isConnecting,
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
}: HeaderProps) {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top,0px)] transition-colors duration-200
                  ${scrolled ? 'bg-white/95 dark:bg-surface/95 backdrop-blur-md border-b border-gray-200 dark:border-white/10' : 'bg-transparent'}`}
      role="banner"
    >
      <div className="h-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Left: Logo + Desktop Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <SolFoundryLogoMark size="md" className="shadow-md shadow-solana-purple/15" />
            <span className="text-lg font-bold text-gray-900 dark:text-white tracking-tight hidden sm:block group-hover:text-solana-purple transition-colors">
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
                className={`inline-flex min-h-11 items-center px-4 py-2 rounded-lg text-base font-medium transition-colors
                  ${!link.external && (currentPath === link.href || currentPath.startsWith(link.href + '/'))
                    ? 'text-solana-green bg-solana-green/10'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                aria-current={!link.external && currentPath === link.href ? 'page' : undefined}
              >
                {link.label}
              </a>
            ))}
            <button
              type="button"
              onClick={onShowOnboarding}
              className="inline-flex min-h-11 items-center px-4 py-2 rounded-lg text-base font-bold text-solana-green hover:bg-solana-green/10 bg-solana-green/5 transition-all ml-4 border border-solana-green/20"
            >
              Get Started
            </button>
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Wallet Connect Button */}
          {walletAddress ? (
            <div className="relative">
              <button
                type="button"
                onClick={onToggleUserMenu}
                className="flex min-h-11 items-center gap-2 px-3 py-2 rounded-lg bg-solana-green/10 border border-solana-green/30
                         text-solana-green text-base font-medium hover:bg-solana-green/20 transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-solana-purple to-solana-green flex items-center justify-center overflow-hidden">
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
                <div className="absolute right-0 mt-2 w-48 py-2 rounded-lg bg-white dark:bg-surface-100 border border-gray-200 dark:border-white/10 shadow-xl">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-white/10">
                    <p className="text-base font-medium text-gray-900 dark:text-white">{userName || 'User'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{truncateAddress(walletAddress)}</p>
                  </div>
                  <a href="/creator" className="flex min-h-11 items-center px-4 py-2 text-base text-solana-green hover:bg-gray-100 dark:hover:bg-white/5 hover:text-solana-green">
                    Creator Dashboard
                  </a>
                  <a href="/dashboard" className="flex min-h-11 items-center px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white">
                    Contributor Dashboard
                  </a>
                  <a href="/profile" className="flex min-h-11 items-center px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white">
                    Profile
                  </a>
                  <a href="/settings" className="flex min-h-11 items-center px-4 py-2 text-base text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white">
                    Settings
                  </a>
                  <button
                    type="button"
                    onClick={onDisconnectWallet}
                    className="flex min-h-11 w-full items-center px-4 py-2 text-left text-base text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-red-600 dark:hover:text-red-300"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <LoadingButton
              onClick={onConnectWallet}
              isLoading={isConnecting}
              loadingText="Connecting..."
              className="min-h-11 gap-2 px-4 py-2 bg-gradient-to-r from-solana-purple to-solana-green hover:opacity-90 shadow-lg shadow-solana-purple/20"
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                </svg>
              }
            >
              Connect Wallet
            </LoadingButton>
          )}

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="lg:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg
                     text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
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
      className={`fixed left-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] max-w-[100vw] flex-col bg-white shadow-xl dark:bg-surface border-r border-gray-200 dark:border-white/10
                top-[calc(4rem+env(safe-area-inset-top,0px))]
                bottom-0 pb-[env(safe-area-inset-bottom,0px)]
                transform transition-[transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform lg:hidden
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      role="navigation"
      aria-label="Mobile navigation"
      aria-hidden={!isOpen}
    >
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={link.external ? undefined : () => onNavClick(link.href)}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noopener noreferrer' : undefined}
            className={`flex min-h-11 items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors
              ${!link.external && (currentPath === link.href || currentPath.startsWith(link.href + '/'))
                ? 'text-solana-green bg-solana-green/10'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            aria-current={!link.external && currentPath === link.href ? 'page' : undefined}
          >
            {link.label}
          </a>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="shrink-0 border-t border-gray-200 dark:border-white/10 bg-white p-4 dark:bg-surface">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">Theme</span>
          <SimpleThemeToggle showSystemOption />
        </div>
        <p className="text-xs text-gray-500 text-center font-mono">
          SolFoundry v0.1.0
        </p>
      </div>
    </aside>
  );
}

export default SiteLayout;