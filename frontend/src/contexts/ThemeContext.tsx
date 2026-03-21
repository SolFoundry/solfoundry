/**
 * ThemeContext - Dark/Light/System theme management with localStorage persistence
 * @module contexts/ThemeContext
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  /** Current theme mode (light, dark, or system) */
  theme: ThemeMode;
  /** Resolved theme based on system preference (always 'light' or 'dark') */
  resolvedTheme: ResolvedTheme;
  /** Set the theme mode */
  setTheme: (theme: ThemeMode) => void;
  /** Toggle between light and dark (ignores system mode) */
  toggleTheme: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const THEME_STORAGE_KEY = 'solfoundry-theme';
const DEFAULT_THEME: ThemeMode = 'dark';

// ============================================================================
// Context
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access theme context
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme if not set in localStorage */
  defaultTheme?: ThemeMode;
  /** Storage key for persistence */
  storageKey?: string;
}

/**
 * ThemeProvider - Provides theme context with localStorage persistence
 * 
 * Features:
 * - Supports 'light', 'dark', and 'system' modes
 * - Persists theme preference to localStorage
 * - Listens to system preference changes (prefers-color-scheme)
 * - Applies theme via Tailwind's 'dark' class strategy
 */
export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  // Initialize theme from localStorage or default
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // localStorage might not be available
    }
    return defaultTheme;
  });

  // Track resolved theme and system preference
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    return getSystemTheme();
  });

  // Get system preference
  function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') {
      return 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Apply theme to document
  const applyTheme = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement;
    
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolved === 'dark' ? '#0a0a0a' : '#ffffff');
    }
  }, []);

  // Set theme and persist
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch {
      // localStorage might not be available
    }
  }, [storageKey]);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Listen for system preference changes
  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setResolvedTheme(e.matches ? 'dark' : 'light');
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  // Update resolved theme when theme mode changes
  useEffect(() => {
    if (theme === 'system') {
      setResolvedTheme(getSystemTheme());
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);

  // Apply theme to document when resolved theme changes
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme, applyTheme]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default ThemeProvider;