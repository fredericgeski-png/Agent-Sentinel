import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';
import type { User } from '../types/auth';
import { authApi, getToken, setToken, clearToken, setAuthCallbacks } from '../api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tokenExpiration: number | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  updateUser: (partial: Partial<User>) => void;
  getToken: () => string | null;
  isTokenExpired: () => boolean;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children, onUpgradeRequired }: { children: ReactNode; onUpgradeRequired?: () => void }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    tokenExpiration: null,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((expiresAtMs: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const msUntilExpiry = expiresAtMs - Date.now();
    const refreshAt = msUntilExpiry - 60 * 60 * 1000; // 1 hour before expiry
    if (refreshAt <= 0) return;

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const resp = await authApi.refresh();
        setToken(resp.token);
        const newExpiry = parseTokenExpiry(resp.token);
        if (newExpiry) {
          setState((s) => ({ ...s, tokenExpiration: newExpiry }));
          scheduleRefresh(newExpiry);
        }
      } catch {
        // Silent fail — user will get 401 on next request
      }
    }, refreshAt);
  }, []);

  const handleUnauthorized = useCallback(() => {
    clearToken();
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null, tokenExpiration: null });
  }, []);

  // Register global callbacks with API client
  useEffect(() => {
    setAuthCallbacks({ onUnauthorized: handleUnauthorized, onUpgradeRequired });
  }, [handleUnauthorized, onUpgradeRequired]);

  // Initialize auth on mount
  useEffect(() => {
    async function initAuth() {
      const token = getToken();
      if (!token) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      const expiry = parseTokenExpiry(token);
      if (expiry && expiry < Date.now()) {
        clearToken();
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      try {
        const { user } = await authApi.me();
        setState({ user, isAuthenticated: true, isLoading: false, error: null, tokenExpiration: expiry });
        if (expiry) scheduleRefresh(expiry);
      } catch {
        clearToken();
        setState({ user: null, isAuthenticated: false, isLoading: false, error: null, tokenExpiration: null });
      }
    }

    initAuth();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [scheduleRefresh]);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const resp = await authApi.login(email, password);
      setToken(resp.token);
      const expiry = parseTokenExpiry(resp.token);
      setState({ user: resp.user, isAuthenticated: true, isLoading: false, error: null, tokenExpiration: expiry });
      if (expiry) scheduleRefresh(expiry);
      localStorage.setItem('kim_user', JSON.stringify(resp.user));
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Login failed';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      throw err;
    }
  }, [scheduleRefresh]);

  const signup = useCallback(async (email: string, password: string, confirmPassword: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const resp = await authApi.signup(email, password, confirmPassword);
      setToken(resp.token);
      const expiry = parseTokenExpiry(resp.token);
      setState({ user: resp.user, isAuthenticated: true, isLoading: false, error: null, tokenExpiration: expiry });
      if (expiry) scheduleRefresh(expiry);
      localStorage.setItem('kim_user', JSON.stringify(resp.user));
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Signup failed';
      setState((s) => ({ ...s, isLoading: false, error: msg }));
      throw err;
    }
  }, [scheduleRefresh]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    clearToken();
    setState({ user: null, isAuthenticated: false, isLoading: false, error: null, tokenExpiration: null });
  }, []);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    try {
      const resp = await authApi.refresh();
      setToken(resp.token);
      return resp.token;
    } catch {
      return null;
    }
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setState((s) => ({ ...s, user: s.user ? { ...s.user, ...partial } : s.user }));
  }, []);

  const isTokenExpired = useCallback((): boolean => {
    const { tokenExpiration } = state;
    if (!tokenExpiration) return true;
    return tokenExpiration < Date.now();
  }, [state]);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login, signup, logout, refreshToken,
      updateUser, getToken, isTokenExpired, clearError,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
