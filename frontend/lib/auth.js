'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);
export const ROOT_ADMIN_EMAIL = 'adipotech@gmail.com';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for existing session on mount
    api('/auth/me')
      .then(data => {
        if (data.user) setUser(normalizeUser(data.user));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  function normalizeUser(u) {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      picture: u.logo_url || null,
      publisherName: u.publisher_name || u.name,
      logoUrl: u.logo_url || null,
      bio: u.bio || '',
      socialLink: u.social_link || '',
      role: u.role || 'user',
      suspended: !!u.suspended,
      createdAt: u.created_at || new Date().toISOString(),
    };
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

  const loginWithGoogle = useCallback(async (credential) => {
    const data = await api('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: credential }),
    });
    const normalized = normalizeUser(data.user);
    setUser(normalized);
    return normalized;
  }, []);

  const updateProfile = useCallback((patch) => {
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, ...patch };
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    setUser(null);
  }, []);

  const value = {
    user,
    ready,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'root',
    isRoot: user?.role === 'root',
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