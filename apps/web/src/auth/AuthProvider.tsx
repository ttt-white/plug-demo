import type { PluginUser } from '@fms/plugin-sdk';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, setUnauthorizedHandler, TOKEN_STORAGE_KEY } from '@/services/api-client';

interface LoginInput {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: PluginUser;
}

interface AuthContextValue {
  user: PluginUser | null;
  bootstrapping: boolean;
  login(input: LoginInput): Promise<void>;
  logout(): void;
  can(permission: string): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PluginUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(sessionStorage.getItem(TOKEN_STORAGE_KEY)));

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    const token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return () => setUnauthorizedHandler(undefined);

    let active = true;
    void apiClient
      .get<{ user: PluginUser }>('/api/auth/me')
      .then((response) => {
        if (active) setUser(response.user);
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setBootstrapping(false);
      });

    return () => {
      active = false;
      setUnauthorizedHandler(undefined);
    };
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      bootstrapping,
      async login(input) {
        const response = await apiClient.post<LoginResponse>('/api/auth/login', input);
        sessionStorage.setItem(TOKEN_STORAGE_KEY, response.token);
        setUser(response.user);
      },
      logout,
      can: (permission) => user?.permissions.includes('*') || user?.permissions.includes(permission) || false,
    }),
    [bootstrapping, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
