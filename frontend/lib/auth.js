// lib/auth.js
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);
export const ROOT_ADMIN_EMAIL = 'adipotech@gmail.com';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const STORAGE_KEY = 'op_auth_session';
const USE_API = !!API_BASE;

const ROLE_RANK = { user: 1, admin: 2, root: 3 };

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

function hasRoleAtLeast(userRole, requiredRole) {
  return (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[requiredRole] || 0);
}

function consumeReturnUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const url = window.sessionStorage.getItem('returnUrl');
    if (url) window.sessionStorage.removeItem('returnUrl');
    return url;
  } catch (e) { return null; }
}

function storeReturnUrl() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem('returnUrl', window.location.pathname);
  } catch (e) { /* ignore */ }
}

let csrfToken = null;

async function fetchCsrfToken() {
  if (csrfToken) return csrfToken;
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    csrfToken = data.token;
    return csrfToken;
  } catch (e) { return null; }
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (options.method && options.method !== 'GET') {
    const token = await fetchCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      headers,
      ...options,
    });
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || `API ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
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
          if (data.user) {
            setUser(normalizeUser(data.user));
            try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeUser(data.user))); } catch(e){}
          } else {
            // Fallback to localStorage if cookie session is empty/invalid
            try {
              const raw = window.localStorage.getItem(STORAGE_KEY);
              if (raw) setUser(JSON.parse(raw));
            } catch (e) {}
          }
          setReady(true);
        })
        .catch(() => {
          try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) setUser(JSON.parse(raw));
          } catch (e) { /* ignore */ }
          setReady(true);
        });
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
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }, []);

  const redirectAfterLogin = useCallback(() => {
    const returnUrl = consumeReturnUrl();
    if (typeof window !== 'undefined' && returnUrl && returnUrl !== window.location.pathname) {
      window.location.href = returnUrl;
    }
  }, []);

  const login = useCallback((profile) => {
    const next = normalizeUser(profile);
    persist(next);
    redirectAfterLogin();
    return next;
  }, [persist, redirectAfterLogin]);

  const loginWithGoogle = useCallback(async (credential) => {
    if (USE_API) {
      try {
        const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ id_token: credential }) });
        const normalized = normalizeUser(data.user);
        persist(normalized);
        redirectAfterLogin();
        return normalized;
      } catch (e) {
        const decoded = decodeGoogleCredential(credential);
        return login(decoded);
      }
    } else {
      const decoded = decodeGoogleCredential(credential);
      return login(decoded);
    }
  }, [login, persist, redirectAfterLogin]);

  const updateProfile = useCallback((patch) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e){}
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    storeReturnUrl();
    if (USE_API) {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    }
    persist(null);
  }, [persist]);

  const can = useCallback((action, ownerId) => {
    if (!user) return false;
    switch (action) {
      case 'create_story':
        return hasRoleAtLeast(user.role, 'user');
      case 'edit_story':
      case 'delete_story':
      case 'view_analytics':
        return user.id === ownerId || hasRoleAtLeast(user.role, 'admin');
      case 'manage_users':
      case 'view_metrics':
      case 'feature_story':
      case 'bulk_operations':
        return hasRoleAtLeast(user.role, 'admin');
      case 'manage_platform':
        return user.role === 'root';
      default:
        return false;
    }
  }, [user]);

  const hasRole = useCallback((role) => {
    if (!user) return false;
    return hasRoleAtLeast(user.role, role);
  }, [user]);

  const value = {
    user, ready,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'root',
    isRoot: user?.role === 'root',
    login, loginWithGoogle, updateProfile, logout,
    can, hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}