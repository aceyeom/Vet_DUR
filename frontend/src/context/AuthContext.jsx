import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken } from '../lib/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'nuvovet_token';
const USER_KEY  = 'nuvovet_user';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://nuvovet-systems.onrender.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
  });
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const _setAuth = useCallback((data) => {
    setToken(data.access_token);
    setUser({ username: data.username });
    setAuthToken(data.access_token);
    try {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username }));
    } catch { /* quota exceeded */ }
  }, []);

  const _clearAuth = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch { /* ignore */ }
  }, []);

  // Validate stored token on mount
  useEffect(() => {
    const storedToken = (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
    if (!storedToken) { setLoading(false); return; }

    setAuthToken(storedToken);
    fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.authenticated) {
          setUser({ username: data.username });
          setToken(storedToken);
        } else {
          _clearAuth();
        }
      })
      .catch(() => {
        // Backend unreachable — keep existing stored user for offline tolerance
        // but don't block the UI
      })
      .finally(() => setLoading(false));
  }, [_clearAuth]);

  const login = useCallback(async (username, password) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.detail || 'Login failed' };
      _setAuth(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error — check your connection' };
    }
  }, [_setAuth]);

  const signup = useCallback(async (username, password) => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.detail || 'Signup failed' };
      _setAuth(data);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error — check your connection' };
    }
  }, [_setAuth]);

  const logout = useCallback(() => {
    _clearAuth();
  }, [_clearAuth]);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, signup, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
