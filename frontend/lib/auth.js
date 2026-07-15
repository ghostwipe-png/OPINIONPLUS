'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'op_auth_session';
export const ROOT_ADMIN_EMAIL = 'adipotech@gmail.com';

// Decode the JWT Google returns. This is client-side only, good enough for
// a prototype. In production, verify the id_token on the Worker before
// trusting any of these fields (see backend/src/routes/auth.js).
function decodeGoogleCredential(credential) {
  const payload = JSON.parse(atob(credential.split('.')[1]));
  return {
    googleSub: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };
}

function roleForEmail(email, existingRole) {
  if (email === ROOT_ADMIN_EMAIL) return 'root';
  return existingRole || 'user';
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {
      /* ignore corrupt storage */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next) => {
    setUser(next);
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    (profile) => {
      const next = {
        id: profile.googleSub || profile.id,
        email: profile.email,
        name: profile.name,
        picture: profile.picture || null,
        publisherName: profile.publisherName || profile.name,
        logoUrl: profile.logoUrl || profile.picture || null,
        bio: profile.bio || '',
        role: roleForEmail(profile.email, profile.role),
        suspended: !!profile.suspended,
        createdAt: profile.createdAt || new Date().toISOString(),
      };
      persist(next);
      return next;
    },
    [persist]
  );

  const loginWithGoogleCredential = useCallback(
    (credential) => {
      const decoded = decodeGoogleCredential(credential);
      return login(decoded);
    },
    [login]
  );

  const updateProfile = useCallback(
    (patch) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const logout = useCallback(() => persist(null), [persist]);

  const value = {
    user,
    ready,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin' || user?.role === 'root',
    isRoot: user?.role === 'root',
    login,
    loginWithGoogleCredential,
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
