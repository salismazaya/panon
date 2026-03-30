import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { API_URL } from '../utils/api';

interface User {
  id: number;
  username: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: { username?: string; currentPassword: string; newPassword?: string }) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('TOKEN'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('TOKEN_USER');
    return saved ? JSON.parse(saved) : null;
  });

  const isAuthenticated = !!token;

  const login = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        localStorage.setItem('TOKEN', data.token);
        localStorage.setItem('TOKEN_USER', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      }

      return { success: false, error: data.error || 'Login failed' };
    } catch {
      return { success: false, error: 'Connection error' };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('TOKEN');
    localStorage.removeItem('TOKEN_USER');
    setToken(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (data: { username?: string; currentPassword: string; newPassword?: string }) => {
    try {
      const response = await fetch(`${API_URL}/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        // Update local user data if username changed
        if (data.username && result.user) {
          const updatedUser = { ...user!, username: result.user.username };
          setUser(updatedUser);
          localStorage.setItem('TOKEN_USER', JSON.stringify(updatedUser));
        }
        // If a new token was issued (e.g. username changed), update it
        if (result.token) {
          localStorage.setItem('TOKEN', result.token);
          setToken(result.token);
        }
        return { success: true };
      }

      return { success: false, error: result.error || 'Update failed' };
    } catch {
      return { success: false, error: 'Connection error' };
    }
  }, [token, user]);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
