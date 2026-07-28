// lib/auth.js
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const AuthContext = createContext(null);
export const ROOT_ADMIN_EMAIL = 'adipotech@gmail.com';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const STORAGE_KEY = 'op_auth_session';
const FINGERPRINT_KEY = 'op_device_fp';
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

// --- device fingerprint ---------------------------------------------------
// A best-effort client hint for the backend's device-trust bookkeeping.
// This is NOT a security boundary by itself — the server is the source of
// truth for whether a device/session is trusted.
export async function getDeviceFingerprint() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem(FINGERPRINT_KEY);
    if (cached) return cached;

    const raw = [
      navigator.userAgent,
      navigator.platform,
      `${window.screen.width}x${window.screen.height}`,
    ].join('::');

    let fingerprint = raw;
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(raw);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      fingerprint = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    window.localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    return fingerprint;
  } catch (e) {
    return null;
  }
}

// --- offline retry queue ---------------------------------------------------
const MAX_OFFLINE_RETRIES = 3;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [sessionMeta, setSessionMeta] = useState(null); // { loginHistory, trustedDeviceCount, ... }
  const offlineRetries = useRef(0);
  const pendingCredential = useRef(null);

  const persist = useCallback((next) => {
    setUser(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }, []);

  const checkSession = useCallback(async () => {
    if (!USE_API) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch (e) { /* ignore */ }
      setReady(true);
      return;
    }

    try {
      const data = await api('/auth/me');
      if (data.user) {
        setUser(normalizeUser(data.user));
        setSessionMeta({
          loginHistory: data.loginHistory || [],
          trustedDeviceCount: data.trustedDeviceCount || 0,
          unreadSecurityEventCount: data.unreadSecurityEventCount || 0,
        });
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeUser(data.user))); } catch (e) {}
      } else {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) setUser(JSON.parse(raw));
        } catch (e) {}
      }
    } catch (e) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch (e2) { /* ignore */ }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    checkSession();

    // Cross-tab sync: if another tab logs in/out, mirror it here.
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY) return;
      try {
        setUser(e.newValue ? JSON.parse(e.newValue) : null);
      } catch (err) { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [checkSession]);

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
        const fingerprint = await getDeviceFingerprint();
        const data = await api('/auth/google', {
          method: 'POST',
          body: JSON.stringify({ id_token: credential, device_fingerprint: fingerprint }),
        });
        const normalized = normalizeUser(data.user);
        persist(normalized);
        offlineRetries.current = 0;
        pendingCredential.current = null;
        redirectAfterLogin();
        return normalized;
      } catch (e) {
        // If we're offline, queue this credential for a silent retry once
        // connectivity returns, instead of failing outright.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          pendingCredential.current = credential;
          throw new Error('You appear to be offline. We\'ll retry automatically once you\'re back online.');
        }
        const decoded = decodeGoogleCredential(credential);
        return login(decoded);
      }
    } else {
      const decoded = decodeGoogleCredential(credential);
      return login(decoded);
    }
  }, [login, persist, redirectAfterLogin]);

  useEffect(() => {
    const onOnline = async () => {
      if (!pendingCredential.current) return;
      if (offlineRetries.current >= MAX_OFFLINE_RETRIES) return;
      offlineRetries.current += 1;
      const credential = pendingCredential.current;
      try {
        await loginWithGoogle(credential);
      } catch (e) { /* leave queued for manual retry / next online event */ }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [loginWithGoogle]);

  const updateProfile = useCallback((patch) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    storeReturnUrl();
    if (USE_API) {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    }
    persist(null);
    setSessionMeta(null);
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
    user, ready, sessionMeta,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'root',
    isRoot: user?.role === 'root',
    login, loginWithGoogle, updateProfile, logout, checkSession,
    can, hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
