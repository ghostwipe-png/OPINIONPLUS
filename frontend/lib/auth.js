'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);
export const ROOT_ADMIN_EMAIL = 'adipotech@gmail.com';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const STORAGE_KEY = 'op_auth_session';
const USE_API = !!API_BASE;

function decodeGoogleCredential(credential) {
  const payload = JSON.parse(atob(credential.split('.')[1]));
  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

function roleForEmail(email) {
  if (email === ROOT_ADMIN_EMAIL) return 'root';
  return 'user';
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `API ${res.status}`);
  }
  return res.json();
}

function normalizeUser(u) {
  return {
    id: u.id || u.googleSub || u.sub,
    email: u.email,
    name: u.name,
    picture: u.picture || u.logo_url || null,
    publisherName: u.publisherName || u.publisher_name || u.name,
    logoUrl: u.logoUrl || u.logo_url || u.picture || null,
    bio: u.bio || '',
    socialLink: u.socialLink || u.social_link || '',
    role: u.role || roleForEmail(u.email),
    suspended: !!u.suspended,
    createdAt: u.createdAt || u.created_at || new Date().toISOString(),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (USE_API) {
      api('/auth/me')
        .then(data => {
          if (data.user) setUser(normalizeUser(data.user));
        })
        .catch(() => {})
        .finally(() => setReady(true));
    } else {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch (e) { /* ignore */ }
      setReady(true);
    }
  }, []);

  const persist = useCallback((next) => {
    setUser(next);
    if (!USE_API) {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback((profile) => {
    const next = normalizeUser(profile);
    persist(next);
    return next;
  }, [persist]);

  const loginWithGoogle = useCallback(async (credential) => {
    if (USE_API) {
      const data = await api('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ id_token: credential }),
      });
      const normalized = normalizeUser(data.user);
      persist(normalized);
      return normalized;
    } else {
      const decoded = decodeGoogleCredential(credential);
      return login(decoded);
    }
  }, [login, persist]);

  const updateProfile = useCallback((patch) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (!USE_API) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    if (USE_API) {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    }
    persist(null);
  }, [persist]);

  const value = {
    user,
    ready,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'root',
    isRoot: user?.role === 'root',
    login,
    loginWithGoogle,
    updateProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}