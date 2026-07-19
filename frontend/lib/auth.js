'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const AuthContext = createContext(null);
export const ROOT_ADMIN_EMAIL = 'adipotech@gmail.com';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const STORAGE_KEY = 'op_auth_session';
const USE_API = !!API_BASE;

// Session / RBAC tuning (NEW) — all configurable via these constants.
const SESSION_DURATION_MS = 60 * 60 * 1000;      // expected session lifetime: 60 min from last validation
const SESSION_WARNING_MS = 2 * 60 * 1000;        // warn 2 min before expiry
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;       // proactive /auth/me check every 5 min
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;    // auto-logout after 30 min idle
const INACTIVITY_WARNING_MS = 60 * 1000;         // warn 1 min before inactivity logout
const SESSION_TICK_MS = 15 * 1000;               // how often expiry/inactivity are checked

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

// RETURN URL HANDLING (NEW)
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

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers,
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

  // NEW — session expiry, inactivity, and single-flight refresh tracking.
  const [sessionExpiringSoon, setSessionExpiringSoon] = useState(false);
  const [lastActivity, setLastActivity] = useState(() => Date.now());
  const lastValidatedRef = useRef(Date.now());
  const refreshInFlightRef = useRef(null);

  useEffect(() => {
    setReady(true);
    if (USE_API) {
      api('/auth/me')
        .then(data => {
          if (data.user) {
            setUser(normalizeUser(data.user));
            lastValidatedRef.current = Date.now();
          }
        })
        .catch(() => {});
    } else {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setUser(JSON.parse(raw));
      } catch (e) { /* ignore */ }
    }
  }, []);

  const persist = useCallback((next) => {
    setUser(next);
    if (!USE_API) {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // Redirects to /login with a returnUrl so the person lands back where they
  // were after signing back in.
  const redirectToLogin = useCallback(() => {
    if (typeof window === 'undefined') return;
    storeReturnUrl();
    window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.pathname)}`;
  }, []);

  const handleSessionExpired = useCallback(() => {
    persist(null);
    setSessionExpiringSoon(false);
    redirectToLogin();
  }, [persist, redirectToLogin]);

  const redirectAfterLogin = useCallback(() => {
    const returnUrl = consumeReturnUrl();
    if (typeof window !== 'undefined' && returnUrl && returnUrl !== window.location.pathname) {
      window.location.href = returnUrl;
    }
  }, []);

  const login = useCallback((profile) => {
    const next = normalizeUser(profile);
    persist(next);
    lastValidatedRef.current = Date.now();
    setSessionExpiringSoon(false);
    redirectAfterLogin();
    return next;
  }, [persist, redirectAfterLogin]);

  const loginWithGoogle = useCallback(async (credential) => {
    if (USE_API) {
      const data = await api('/auth/google', { method: 'POST', body: JSON.stringify({ id_token: credential }) });
      const normalized = normalizeUser(data.user);
      persist(normalized);
      lastValidatedRef.current = Date.now();
      setSessionExpiringSoon(false);
      redirectAfterLogin();
      return normalized;
    } else {
      const decoded = decodeGoogleCredential(credential);
      return login(decoded);
    }
  }, [login, persist, redirectAfterLogin]);

  const updateProfile = useCallback((patch) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (!USE_API) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(async () => {
    storeReturnUrl();
    if (USE_API) {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
    }
    persist(null);
    setSessionExpiringSoon(false);
  }, [persist]);

  // TOKEN / SESSION REFRESH (NEW) — proactively re-checks the httpOnly-cookie
  // session via /auth/me. Only one refresh is ever in flight at a time so
  // multiple components mounting refresh timers don't fire duplicate calls.
  const refreshSession = useCallback(async () => {
    if (!USE_API) return;
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    const p = (async () => {
      try {
        const data = await api('/auth/me');
        if (data.user) {
          setUser(normalizeUser(data.user));
          lastValidatedRef.current = Date.now();
          setSessionExpiringSoon(false);
        } else {
          handleSessionExpired();
        }
      } catch (e) {
        handleSessionExpired();
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = p;
    return p;
  }, [handleSessionExpired]);

  const extendSession = useCallback(async () => {
    await refreshSession();
  }, [refreshSession]);

  // Periodic proactive session check.
  useEffect(() => {
    if (!USE_API || !user) return;
    const interval = setInterval(refreshSession, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, refreshSession]);

  // SESSION EXPIRY WARNING (NEW)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastValidatedRef.current;
      const remaining = SESSION_DURATION_MS - elapsed;
      if (remaining <= 0) {
        handleSessionExpired();
      } else if (remaining <= SESSION_WARNING_MS) {
        setSessionExpiringSoon(true);
      }
    }, SESSION_TICK_MS);
    return () => clearInterval(interval);
  }, [user, handleSessionExpired]);

  // INACTIVITY TIMEOUT (NEW) — passive listeners so scroll/mousemove don't
  // block the main thread.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bump = () => setLastActivity(Date.now());
    const events = ['click', 'keydown', 'scroll', 'mousemove'];
    events.forEach(ev => window.addEventListener(ev, bump, { passive: true }));
    return () => events.forEach(ev => window.removeEventListener(ev, bump));
  }, []);

  useEffect(() => {
    if (!user) return;
    let warned = false;
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity;
      if (idle >= INACTIVITY_TIMEOUT_MS) {
        handleSessionExpired();
      } else if (idle >= INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS && !warned) {
        warned = true;
        console.warn('You will be logged out soon due to inactivity.');
      } else if (idle < INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) {
        warned = false;
      }
    }, SESSION_TICK_MS);
    return () => clearInterval(interval);
  }, [user, lastActivity, handleSessionExpired]);

  // RBAC HELPERS (NEW)
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
    // NEW
    sessionExpiringSoon, extendSession, lastActivity, can, hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
