/**
 * ThemeToggle - Toggle between light, dark, and system theme modes
 * @module components/layout/ThemeToggle
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';

// ============================================================================
// Types
// ============================================================================

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}

// ============================================================================
// Icons
// ============================================================================

function SunIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}

function MoonIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
    </svg>
  );
}

function ComputerIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ============================================================================
// Theme Options
// ============================================================================

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <SunIcon className="w-4 h-4" />,
    description: 'Light mode',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <MoonIcon className="w-4 h-4" />,
    description: 'Dark mode',
  },
  {
    value: 'system',
    label: 'System',
    icon: <ComputerIcon className="w-4 h-4" />,
    description: 'Follow system preference',
  },
];

// ============================================================================
// Component
// ============================================================================

/**
 * ThemeToggle - Dropdown menu for selecting theme mode
 * 
 * Features:
 * - Three options: Light, Dark, System
 * - Shows current theme indicator
 * - Accessible with keyboard navigation
 * - Displays resolved theme when using 'system' mode
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { setMounted(true); }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMenu]);

  useEffect(() => {
    if (isOpen && focusedIndex >= 0) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [isOpen, focusedIndex]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex(THEME_OPTIONS.length - 1);
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((index + 1) % THEME_OPTIONS.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((index - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length);
        break;
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusedIndex(THEME_OPTIONS.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        setTheme(THEME_OPTIONS[index].value);
        closeMenu();
        break;
      case 'Escape':
      case 'Tab':
        closeMenu();
        break;
    }
  };

  const getCurrentIcon = () => {
    if (resolvedTheme === 'dark') return <MoonIcon className="w-5 h-5" />;
    return <SunIcon className="w-5 h-5" />;
  };

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-lg" aria-hidden="true" />
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setFocusedIndex(0); }}
        onKeyDown={handleTriggerKeyDown}
        className="flex items-center gap-1 h-9 px-2 rounded-lg text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solana-purple transition-colors"
        aria-label={`Theme: ${theme === 'system' ? `system (${resolvedTheme})` : theme}. Click to change.`}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? 'theme-listbox' : undefined}
      >
        {getCurrentIcon()}
        <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id="theme-listbox"
          className="absolute right-0 mt-2 w-44 py-1 rounded-lg bg-white dark:bg-surface-100 border border-gray-200 dark:border-white/10 shadow-xl z-50"
          role="listbox"
          aria-label="Select theme"
          tabIndex={-1}
        >
          {THEME_OPTIONS.map((option, index) => (
            <button
              key={option.value}
              ref={(el) => { optionRefs.current[index] = el; }}
              type="button"
              role="option"
              aria-selected={theme === option.value}
              tabIndex={focusedIndex === index ? 0 : -1}
              onClick={() => { setTheme(option.value); closeMenu(); }}
              onKeyDown={(e) => handleOptionKeyDown(e, index)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors outline-none
                ${theme === option.value
                  ? 'text-solana-green bg-solana-green/10'
                  : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10'
                }
                ${focusedIndex === index ? 'ring-2 ring-inset ring-solana-purple' : ''}`}
            >
              {option.icon}
              <span className="flex-1 text-left">{option.label}</span>
              {theme === option.value && (
                <CheckIcon className="w-4 h-4 text-solana-green" />
              )}
            </button>
          ))}

          {theme === 'system' && (
            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-white/10 mt-1">
              Currently using {resolvedTheme} mode
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Simple Toggle Version (for compact UIs)
// ============================================================================

interface SimpleThemeToggleProps {
  /** Show system option in cycle */
  showSystemOption?: boolean;
}

/**
 * SimpleThemeToggle - Simple button that cycles through themes
 * Good for mobile or compact layouts
 */
export function SimpleThemeToggle({ showSystemOption = false }: SimpleThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    const modes: ThemeMode[] = showSystemOption 
      ? ['light', 'dark', 'system']
      : ['light', 'dark'];
    
    const currentIndex = modes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % modes.length;
    setTheme(modes[nextIndex]);
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className="h-9 w-9 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solana-purple"
        aria-label="Toggle theme"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="h-9 w-9 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-solana-purple transition-colors"
      aria-label={`Current theme: ${theme}. Click to change.`}
    >
      {theme === 'system' ? (
        <ComputerIcon className="h-5 w-5" />
      ) : resolvedTheme === 'dark' ? (
        <MoonIcon className="h-5 w-5" />
      ) : (
        <SunIcon className="h-5 w-5" />
      )}
    </button>
  );
}

export default ThemeToggle;