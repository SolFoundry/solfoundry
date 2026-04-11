/**
 * AuthContext — JWT token + current user state, persisted to localStorage.
 * Provides login (token storage), logout, and the authenticated user object.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken, setOnAuthExpired } from '../services/apiClient';
import { logout as apiLogout } from '../api/auth';

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
  wallet_address?: string | null;
  wallet_verified?: boolean;
  github_id?: string | null;
  created_at?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'sf_access_token';
const REFRESH_KEY = 'sf_refresh_token';
const USER_KEY = 'sf_user';

/**
 * AuthContext provider — manages JWT token + current user state, persisted to localStorage.
 * Provides login (token storage), logout, and the authenticated user object.
 * Wire this into the app root to make auth state available via `useAuthContext`.
 *
 * @param children - The React subtree that will have access to the auth context
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const refresh = localStorage.getItem(REFRESH_KEY);
    const userRaw = localStorage.getItem(USER_KEY);

    if (token && userRaw) {
      try {
        const user = JSON.parse(userRaw) as AuthUser;
        setAuthToken(token);
        setState({ user, accessToken: token, refreshToken: refresh, isAuthenticated: true, isLoading: false });
        return;
      } catch {
        // malformed — clear
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setState(s => ({ ...s, isLoading: false }));
  }, []);

  const login = useCallback((accessToken: string, refreshToken: string, user: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setAuthToken(accessToken);
    setState({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isLoading: false });
  }, []);

  // Wire apiClient's auth-expired callback to logout
  useEffect(() => {
    setOnAuthExpired(logout);
    return () => setOnAuthExpired(null);
  }, [logout]);

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...updates };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return { ...prev, user: updated };
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the auth context value.
 * Throws if called outside of an `AuthProvider` tree.
 */
export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}
