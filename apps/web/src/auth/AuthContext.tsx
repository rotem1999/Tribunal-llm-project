import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '@tribunal/shared-types';
import * as authApi from '../api/auth';
import { configureClient } from '../api/client';

const TOKEN_KEY = 'tribunal.token';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [user, setUser] = useState<AuthUser | null>(null);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    navigate('/login');
  }, [navigate]);

  // Wire the API client to the current token + 401 handler.
  useEffect(() => {
    configureClient(() => token, signOut);
  }, [token, signOut]);

  // Load the current user whenever we hold a token but don't yet know them.
  useEffect(() => {
    if (token && !user) {
      authApi.fetchMe().then(setUser).catch(() => undefined);
    }
  }, [token, user]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const { accessToken } = await authApi.login(username, password);
      try {
        sessionStorage.setItem(TOKEN_KEY, accessToken);
      } catch {
        /* ignore */
      }
      setToken(accessToken);
    },
    [],
  );

  const value = useMemo(
    () => ({ token, user, signIn, signOut }),
    [token, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
