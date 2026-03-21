import { useState, useRef, useEffect } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { WalletConnect } from '../wallet';

interface HeaderProps {
  sidebarCollapsed: boolean;
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      className="sticky top-0 z-20 flex h-14 items-center justify-between border-b
                 border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80
                 backdrop-blur-md px-4 sm:px-6"
      role="banner"
    >
      {/* Left: Mobile menu + Search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg
                     text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                     hover:bg-gray-100 dark:hover:bg-gray-800
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                     lg:hidden"
          aria-label="Open navigation menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Search bar */}
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors
                      ${searchFocused
                        ? 'border-brand-400 bg-white dark:bg-gray-800 ring-2 ring-brand-500/20'
                        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                      } flex-1 max-w-md`}
        >
          <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full bg-transparent text-sm text-gray-900 dark:text-gray-100
                       placeholder-gray-400 dark:placeholder-gray-500
                       focus:outline-none"
            aria-label="Search"
          />
          <kbd
            className="hidden sm:inline-flex items-center rounded border border-gray-200 dark:border-gray-700
                       bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-medium
                       text-gray-500 dark:text-gray-400"
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Wallet + Actions */}
      <div className="flex items-center gap-2 ml-4">
        <WalletConnect />
        <ThemeToggle />

        {/* Notification bell */}
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg
                     text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                     hover:bg-gray-100 dark:hover:bg-gray-800
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          aria-label="Notifications"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </button>

        {/* Avatar */}
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-purple-500
                     flex items-center justify-center text-white text-xs font-bold
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          aria-label="User menu"
        >
          U
        </button>
      </div>
    </header>
  );
}