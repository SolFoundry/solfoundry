/**
 * Tests for useTheme hook
 * 
 * Tests cover:
 * - Default theme initialization
 * - localStorage persistence
 * - System preference fallback
 * - Toggle behavior
 * - DOM class application
 */
import { renderHook, act } from '@testing-library/react';
import { useTheme } from './useTheme';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia - default to light system preference
const createMatchMedia = (matches: boolean) => 
  jest.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

describe('useTheme', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.remove('theme-transitioning');
    // Default to light system preference
    Object.defineProperty(window, 'matchMedia', {
      value: createMatchMedia(false),
      writable: true,
    });
  });

  it('should default to light theme when system prefers light and no stored preference', () => {
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should default to dark theme when system prefers dark and no stored preference', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: createMatchMedia(true),
      writable: true,
    });
    
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should use stored theme from localStorage over system preference', () => {
    localStorageMock.getItem.mockReturnValue('dark');
    
    const { result } = renderHook(() => useTheme());
    
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should toggle between light and dark themes', () => {
    const { result } = renderHook(() => useTheme());
    
    // Starts with light (system preference)
    expect(result.current.theme).toBe('light');
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist theme to localStorage when toggled', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith('solfoundry-theme', 'dark');
  });

  it('should set theme directly with setTheme', () => {
    const { result } = renderHook(() => useTheme());
    
    act(() => {
      result.current.setTheme('dark');
    });
    
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should handle localStorage errors gracefully', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    
    // Should not throw
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBeDefined();
  });

  it('should apply correct DOM classes when theme changes', () => {
    const { result } = renderHook(() => useTheme());
    
    // Light theme - no dark class
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    
    // Set to dark
    act(() => {
      result.current.setTheme('dark');
    });
    
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    
    // Set back to light
    act(() => {
      result.current.setTheme('light');
    });
    
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});