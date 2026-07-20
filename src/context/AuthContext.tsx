import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { apiGetUser } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);
const SESSION_TIMEOUT = 3 * 60 * 1000; // 3 minutes
const WARNING_BEFORE = 15 * 1000; // 15 seconds before timeout

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('rolpay_user');
    const lastActivity = localStorage.getItem('rolpay_last_activity');
    if (saved && lastActivity && Date.now() - Number(lastActivity) > SESSION_TIMEOUT) {
      localStorage.removeItem('rolpay_user');
      localStorage.removeItem('rolpay_token');
      localStorage.removeItem('rolpay_last_activity');
      return null;
    }
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    const lastActivity = localStorage.getItem('rolpay_last_activity');
    if (lastActivity && Date.now() - Number(lastActivity) > SESSION_TIMEOUT) {
      localStorage.removeItem('rolpay_token');
      localStorage.removeItem('rolpay_last_activity');
      return null;
    }
    return localStorage.getItem('rolpay_token');
  });
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const warningTimerRef = useRef<number | null>(null);
  const logoutTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Force re-fetch user data from API on startup to get latest foto_perfil
  useEffect(() => {
    if (!token) return;
    apiGetUser(token)
      .then((fresh) => setUser(fresh))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem('rolpay_token', token);
    else localStorage.removeItem('rolpay_token');
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem('rolpay_user', JSON.stringify(user));
    else localStorage.removeItem('rolpay_user');
  }, [user]);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null; }
    if (logoutTimerRef.current) { clearTimeout(logoutTimerRef.current); logoutTimerRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    setShowWarning(false);
    setCountdown(15);
  }, []);

  const logout = useCallback(() => {
    clearAllTimers();
    setToken(null);
    setUser(null);
    setShowWarning(false);
    localStorage.removeItem('rolpay_token');
    localStorage.removeItem('rolpay_user');
    localStorage.removeItem('rolpay_last_activity');
  }, [clearAllTimers]);

  const stayLoggedIn = useCallback(() => {
    clearAllTimers();
    localStorage.setItem('rolpay_last_activity', String(Date.now()));
  }, [clearAllTimers]);

  // Session timeout - auto logout after inactivity with warning
  useEffect(() => {
    if (!token) return;

    const updateActivity = () => {
      localStorage.setItem('rolpay_last_activity', String(Date.now()));
      clearAllTimers();

      // Set warning timer (at 2:45, which is 15s before 3:00)
      warningTimerRef.current = window.setTimeout(() => {
        setShowWarning(true);
        setCountdown(15);

        // Start countdown
        countdownIntervalRef.current = window.setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              // Time's up - logout
              clearAllTimers();
              setToken(null);
              setUser(null);
              setShowWarning(false);
              localStorage.removeItem('rolpay_token');
              localStorage.removeItem('rolpay_user');
              localStorage.removeItem('rolpay_last_activity');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, SESSION_TIMEOUT - WARNING_BEFORE);
    };

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('rolpay_last_activity');
      if (lastActivity && Date.now() - Number(lastActivity) > SESSION_TIMEOUT) {
        logout();
      }
    };

    updateActivity();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => document.addEventListener(e, updateActivity, { passive: true }));
    const interval = setInterval(checkInactivity, 5000);

    // Logout on tab close
    const handleBeforeUnload = () => {
      // Send beacon to mark logout (best-effort)
      const tokenVal = localStorage.getItem('rolpay_token');
      if (tokenVal) {
        navigator.sendBeacon('/api/auth/logout', new Blob([''], { type: 'application/json' }));
      }
      localStorage.removeItem('rolpay_token');
      localStorage.removeItem('rolpay_user');
      localStorage.removeItem('rolpay_last_activity');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      events.forEach((e) => document.removeEventListener(e, updateActivity));
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearAllTimers();
    };
  }, [token, logout, clearAllTimers]);

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

      {/* Inactivity Warning Dialog */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Sesión por expirar</h3>
            <p className="text-slate-400 text-sm mb-1">Tu sesión expirará por inactividad.</p>
            <p className="text-amber-400 text-2xl font-bold mb-4">{countdown}s</p>
            <div className="flex gap-3">
              <button
                onClick={logout}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-700/50 text-slate-300 hover:bg-slate-700 border border-slate-600/30 transition cursor-pointer"
              >
                Cerrar sesión
              </button>
              <button
                onClick={stayLoggedIn}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition cursor-pointer"
              >
                Seguir
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
