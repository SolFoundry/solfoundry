/**
 * ThemeToggle Component
 * 
 * A theme toggle button for switching between light, dark, and system themes.
 * Displays current theme icon and cycles through: light → dark → system → light
 * 
 * Features:
 * - Three-state toggle: light, dark, system
 * - Smooth icon transitions
 * - Tooltip showing current theme
 * - Accessible with keyboard support
 * - Tailwind CSS dark: variant compatible
 * 
 * @module ThemeToggle
 */

import React, { useState, useEffect } from 'react';
import { getStoredTheme, setTheme, getEffectiveTheme, Theme } from './theme';

// ============================================================================
// Types
// ============================================================================

export interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'button' | 'icon' | 'dropdown';
}

// ============================================================================
// Icons
// ============================================================================

const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" 
    />
  </svg>
);

const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" 
    />
  </svg>
);

const MonitorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={1.5} 
    stroke="currentColor"
  >
    <path 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" 
    />
  </svg>
);

// ============================================================================
// ThemeToggle Component
// ============================================================================

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  size = 'md',
  variant = 'button',
}) => {
  const [theme, setThemeState] = useState<Theme>('system');
  const [isMounted, setIsMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    setIsMounted(true);
    const stored = getStoredTheme();
    setThemeState(stored);
  }, []);

  // Handle theme cycling: light → dark → system → light
  const handleToggle = () => {
    const nextTheme: Theme = 
      theme === 'light' ? 'dark' : 
      theme === 'dark' ? 'system' : 
      'light';
    
    setTheme(nextTheme);
    setThemeState(nextTheme);
  };

  // Get icon based on current theme
  const getIcon = () => {
    if (!isMounted) {
      // SSR: return monitor icon (system default)
      return <MonitorIcon className="w-5 h-5" />;
    }

    switch (theme) {
      case 'light':
        return <SunIcon className="w-5 h-5" />;
      case 'dark':
        return <MoonIcon className="w-5 h-5" />;
      case 'system':
      default:
        return <MonitorIcon className="w-5 h-5" />;
    }
  };

  // Get tooltip text
  const getTooltip = () => {
    const effectiveTheme = getEffectiveTheme();
    
    switch (theme) {
      case 'light':
        return 'Light theme (click for dark)';
      case 'dark':
        return 'Dark theme (click for system)';
      case 'system':
      default:
        return `System theme (${effectiveTheme}) (click for light)`;
    }
  };

  // Size classes
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  // Render dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className={`relative ${className}`}>
        <select
          value={theme}
          onChange={(e) => {
            const newTheme = e.target.value as Theme;
            setTheme(newTheme);
            setThemeState(newTheme);
          }}
          className="appearance-none bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#9945FF]/50"
          aria-label="Theme selection"
        >
          <option value="light">☀️ Light</option>
          <option value="dark">🌙 Dark</option>
          <option value="system">💻 System</option>
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>
    );
  }

  // Render button or icon variant
  return (
    <button
      onClick={handleToggle}
      className={`
        relative inline-flex items-center justify-center rounded-lg
        text-gray-300 hover:text-white hover:bg-white/5
        transition-all duration-200 ease-in-out
        ${sizeClasses[size]}
        ${className}
      `}
      title={getTooltip()}
      aria-label={`Theme: ${theme}. Click to change.`}
      type="button"
    >
      {/* Icon with smooth transition */}
      <div className="relative w-5 h-5">
        <div 
          className={`absolute inset-0 transition-all duration-200 ease-in-out transform
            ${isMounted && theme !== 'light' ? 'opacity-0 scale-75 rotate-45' : 'opacity-100 scale-100 rotate-0'}
          `}
        >
          <SunIcon className="w-5 h-5" />
        </div>
        <div 
          className={`absolute inset-0 transition-all duration-200 ease-in-out transform
            ${isMounted && theme !== 'dark' ? 'opacity-0 scale-75 -rotate-45' : 'opacity-100 scale-100 rotate-0'}
          `}
        >
          <MoonIcon className="w-5 h-5" />
        </div>
        <div 
          className={`absolute inset-0 transition-all duration-200 ease-in-out transform
            ${isMounted && theme !== 'system' ? 'opacity-0 scale-75 rotate-90' : 'opacity-100 scale-100 rotate-0'}
          `}
        >
          <MonitorIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Theme indicator dot (for button variant) */}
      {variant === 'button' && (
        <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2">
          <div className={`w-1 h-1 rounded-full transition-colors duration-200 ${
            theme === 'light' ? 'bg-yellow-400' :
            theme === 'dark' ? 'bg-purple-400' :
            'bg-gray-400'
          }`} />
        </div>
      )}
    </button>
  );
};

export default ThemeToggle;
