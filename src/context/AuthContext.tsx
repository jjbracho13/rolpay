import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('rolpay_user');
    const lastActivity = localStorage.getItem('rolpay_last_activity');
    if (saved && lastActivity && Date.now() - Number(lastActivity) > SESSION_TIMEOUT) {
      localStorage.removeItem('rolpay_user');
      localStorage.removeItem('rolpay_token');
      return null;
    }
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    const lastActivity = localStorage.getItem('rolpay_last_activity');
    if (lastActivity && Date.now() - Number(lastActivity) > SESSION_TIMEOUT) {
      localStorage.removeItem('rolpay_token');
      return null;
    }
    return localStorage.getItem('rolpay_token');
  });

  useEffect(() => {
    if (token) localStorage.setItem('rolpay_token', token);
    else localStorage.removeItem('rolpay_token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('rolpay_user', JSON.stringify(user));
    else localStorage.removeItem('rolpay_user');
  }, [user]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('rolpay_token');
    localStorage.removeItem('rolpay_user');
    localStorage.removeItem('rolpay_last_activity');
  }, []);

  // Session timeout - auto logout after inactivity
  useEffect(() => {
    if (!token) return;

    const updateActivity = () => {
      localStorage.setItem('rolpay_last_activity', String(Date.now()));
    };

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('rolpay_last_activity');
      if (lastActivity && Date.now() - Number(lastActivity) > SESSION_TIMEOUT) {
        logout();
      }
    };

    updateActivity();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach((e) => document.addEventListener(e, updateActivity, { passive: true }));
    const interval = setInterval(checkInactivity, 60 * 1000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [token, logout]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('rolpay_last_activity', String(Date.now()));
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
