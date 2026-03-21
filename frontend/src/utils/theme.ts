/**
 * Theme Management Utility
 * 
 * Handles dark/light theme switching with localStorage persistence.
 * Respects system preference (prefers-color-scheme) as default.
 * 
 * Key features:
 * - localStorage key: solfoundry-theme
 * - Default: system (respects prefers-color-scheme)
 * - Values: 'light' | 'dark' | 'system'
 * 
 * @module theme
 */

// ============================================================================
// Types
// ============================================================================

export type Theme = 'light' | 'dark' | 'system';

// ============================================================================
// Constants
// ============================================================================

const THEME_STORAGE_KEY = 'solfoundry-theme';
const THEME_ATTRIBUTE = 'data-theme';

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get the system's color scheme preference
 */
function getSystemPreference(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'dark'; // SSR default
  }
  
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * Get the stored theme from localStorage
 * Returns 'system' if not set or invalid
 */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'system'; // SSR default
  }
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }
  
  return 'system';
}

/**
 * Get the effective theme (resolves 'system' to actual value)
 */
export function getEffectiveTheme(): 'light' | 'dark' {
  const stored = getStoredTheme();
  
  if (stored === 'system') {
    return getSystemPreference();
  }
  
  return stored;
}

/**
 * Apply theme to the document
 * Adds/removes 'dark' class on <html> element for Tailwind
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') {
    return; // SSR
  }
  
  const effectiveTheme = theme === 'system' ? getSystemPreference() : theme;
  
  if (effectiveTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  // Also set data attribute for more specific styling if needed
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
}

/**
 * Store theme preference in localStorage
 */
export function storeTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return; // SSR
  }
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to store theme in localStorage:', error);
  }
}

/**
 * Set theme and apply it immediately
 */
export function setTheme(theme: Theme): void {
  storeTheme(theme);
  applyTheme(theme);
}

/**
 * Toggle between light and dark themes
 * If current is 'system', toggle based on system preference
 */
export function toggleTheme(): Theme {
  const current = getStoredTheme();
  const effective = getEffectiveTheme();
  
  // Toggle to opposite of current effective theme
  const newTheme: Theme = effective === 'dark' ? 'light' : 'dark';
  
  setTheme(newTheme);
  return newTheme;
}

/**
 * Initialize theme on page load
 * Call this as early as possible to prevent FOUC
 */
export function initializeTheme(): void {
  const theme = getStoredTheme();
  applyTheme(theme);
}

/**
 * Listen for system theme changes
 * Only applies if current theme is 'system'
 */
export function watchSystemTheme(): () => void {
  if (typeof window === 'undefined') {
    return () => {}; // SSR
  }
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  const handleChange = () => {
    const current = getStoredTheme();
    if (current === 'system') {
      applyTheme('system');
    }
  };
  
  mediaQuery.addEventListener('change', handleChange);
  
  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
}

// ============================================================================
// Inline Script (for preventing FOUC)
// ============================================================================

/**
 * Get the inline script to prevent FOUC
 * This should be placed in <head> before any CSS
 */
export function getFOUCPreventionScript(): string {
  return `
(function() {
  try {
    var theme = localStorage.getItem('solfoundry-theme');
    var effectiveTheme = 'dark';
    
    if (theme === 'light') {
      effectiveTheme = 'light';
    } else if (theme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else if (theme === 'dark') {
      effectiveTheme = 'dark';
    } else {
      // No stored preference, use system
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    if (effectiveTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    document.documentElement.setAttribute('data-theme', theme || 'system');
  } catch (e) {
    console.warn('Theme initialization failed:', e);
  }
})();
`.trim();
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * React hook for theme management
 * Usage: const { theme, setTheme, toggleTheme, effectiveTheme } = useTheme();
 */
export function useTheme() {
  const { useState, useEffect, useCallback } = require('react');
  
  const [theme, setThemeState] = useState<Theme>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    // Initialize theme on mount
    const stored = getStoredTheme();
    setThemeState(stored);
    setEffectiveTheme(getEffectiveTheme());
    applyTheme(stored);
    
    // Watch for system theme changes
    return watchSystemTheme();
  }, []);

  useEffect(() => {
    // Update effective theme when theme changes
    setEffectiveTheme(getEffectiveTheme());
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    setTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = toggleTheme();
    setThemeState(newTheme);
  }, []);

  return { theme, setTheme, toggleTheme, effectiveTheme };
}
