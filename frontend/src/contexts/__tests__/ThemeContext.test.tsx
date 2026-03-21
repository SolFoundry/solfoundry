/**
 * Tests for ThemeContext
 * @module contexts/__tests__/ThemeContext.test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useTheme, ThemeMode, ResolvedTheme } from '../ThemeContext';

// ============================================================================
// Test Component
// ============================================================================

function TestComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button onClick={() => setTheme('light')} data-testid="set-light">Set Light</button>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">Set Dark</button>
      <button onClick={() => setTheme('system')} data-testid="set-system">Set System</button>
      <button onClick={toggleTheme} data-testid="toggle">Toggle</button>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const renderWithProvider = (defaultTheme?: ThemeMode, storageKey?: string) => {
  return render(
    <ThemeProvider defaultTheme={defaultTheme} storageKey={storageKey}>
      <TestComponent />
    </ThemeProvider>
  );
};

// ============================================================================
// Tests
// ============================================================================

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Reset document classes
    document.documentElement.className = '';
    // Mock matchMedia for dark mode
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should use default theme when no stored theme', () => {
      renderWithProvider('dark');
      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });

    it('should use stored theme from localStorage', () => {
      localStorage.setItem('test-theme', 'light');
      renderWithProvider('dark', 'test-theme');
      expect(screen.getByTestId('theme').textContent).toBe('light');
    });

    it('should fallback to default theme for invalid stored value', () => {
      localStorage.setItem('test-theme', 'invalid');
      renderWithProvider('dark', 'test-theme');
      expect(screen.getByTestId('theme').textContent).toBe('dark');
    });
  });

  describe('Theme Selection', () => {
    it('should set theme to light', () => {
      renderWithProvider('dark');
      
      fireEvent.click(screen.getByTestId('set-light'));
      
      expect(screen.getByTestId('theme').textContent).toBe('light');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    });

    it('should set theme to dark', () => {
      renderWithProvider('light');
      
      fireEvent.click(screen.getByTestId('set-dark'));
      
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    });

    it('should set theme to system', () => {
      renderWithProvider('light');
      
      fireEvent.click(screen.getByTestId('set-system'));
      
      expect(screen.getByTestId('theme').textContent).toBe('system');
    });

    it('should persist theme to localStorage', () => {
      renderWithProvider('dark', 'test-theme');
      
      fireEvent.click(screen.getByTestId('set-light'));
      
      expect(localStorage.getItem('test-theme')).toBe('light');
    });
  });

  describe('Toggle Theme', () => {
    it('should toggle from dark to light', () => {
      renderWithProvider('dark');
      
      fireEvent.click(screen.getByTestId('toggle'));
      
      expect(screen.getByTestId('theme').textContent).toBe('light');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    });

    it('should toggle from light to dark', () => {
      renderWithProvider('light');
      
      fireEvent.click(screen.getByTestId('toggle'));
      
      expect(screen.getByTestId('theme').textContent).toBe('dark');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    });
  });

  describe('System Theme', () => {
    it('should use light when system prefers light', () => {
      mockMatchMedia(false); // prefers-color-scheme: light
      
      renderWithProvider('light');
      fireEvent.click(screen.getByTestId('set-system'));
      
      expect(screen.getByTestId('theme').textContent).toBe('system');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
    });

    it('should use dark when system prefers dark', () => {
      mockMatchMedia(true); // prefers-color-scheme: dark
      
      renderWithProvider('light');
      fireEvent.click(screen.getByTestId('set-system'));
      
      expect(screen.getByTestId('theme').textContent).toBe('system');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
    });
  });

  describe('DOM Updates', () => {
    it('should add dark class to document when dark theme', () => {
      renderWithProvider('light');
      
      fireEvent.click(screen.getByTestId('set-dark'));
      
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should remove dark class from document when light theme', () => {
      document.documentElement.classList.add('dark');
      renderWithProvider('dark');
      
      fireEvent.click(screen.getByTestId('set-light'));
      
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useTheme is used outside provider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => render(<TestComponent />)).toThrow(
        'useTheme must be used within a ThemeProvider'
      );
      
      consoleError.mockRestore();
    });
  });
});