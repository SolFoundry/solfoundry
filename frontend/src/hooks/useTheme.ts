/**
 * useTheme - Theme management hook for dark/light mode toggle
 * 
 * Features:
 * - Persist theme preference in localStorage
 * - Respect system preference (prefers-color-scheme) as default
 * - Smooth transition between themes
 * - Apply dark class to document.documentElement
 */
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'solfoundry-theme';

/**
 * Get the system preference for color scheme
 */
function getSystemPreference(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the stored theme preference from localStorage
 */
function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return null;
}

/**
 * Apply theme to the document
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  // Add transition class for smooth theme change
  root.classList.add('theme-transition');
  
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  
  // Remove transition class after animation
  setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 300);
}

/**
 * useTheme hook
 * 
 * @returns {Object} - { theme, toggleTheme, setTheme }
 */
export function useTheme(): {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Priority: localStorage > system preference > default (dark)
    const stored = getStoredTheme();
    if (stored) return stored;
    return getSystemPreference();
  });

  // Apply theme on mount and when theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't set a preference
      if (!getStoredTheme()) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  /**
   * Set theme and save to localStorage
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }, []);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return { theme, toggleTheme, setTheme };
}

export default useTheme;