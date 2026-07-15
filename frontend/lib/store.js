'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const StoreContext = createContext(null);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const STORAGE_KEY = 'op_store_v1';
const USE_API = !!API_BASE; // Uses API when deployed, localStorage when not

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

const SEED = {
  users: [
    {
      id: 'u_amara', email: 'amara.okoye@example.com', name: 'Amara Okoye',
      publisherName: 'Amara Okoye',
      logoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop',
      bio: 'Independent journalist covering land rights across the Rift Valley.',
      role: 'user', suspended: false, createdAt: '2025-11-02T09:00:00.000Z',
    },
    {
      id: 'u_kito', email: 'kito.films@example.com', name: 'Kito Wanjala',
      publisherName: 'Kito Wanjala Films',
      logoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
      bio: 'Documentary maker. Streets, markets, the people who run them.',
      role: 'user', suspended: false, createdAt: '2025-11-10T09:00:00.000Z',
    },
    {
      id: 'u_lena', email: 'lena.p@example.com', name: 'Lena Petrova',
      publisherName: 'Lena Petrova',
      logoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
      bio: 'Writing about migration, memory, and the Baltic coast.',
      role: 'user', suspended: false, createdAt: '2025-12-01T09:00:00.000Z',
    },
  ],
  stories: [
    {
      id: 's_1', authorId: 'u_amara', title: 'The Fence Line', type: 'story', privacy: 'public',
      excerpt: 'A survey company drew a line through three villages. Nobody asked who was on which side.',
      body: '<p>The surveyors arrived on a Tuesday, in a truck with government plates and no explanation.</p><p>By Thursday there was a line of orange stakes running through Mama Achieng\'s sorghum field.</p>',
      coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&h=700&fit=crop',
      files: [], mediaBlocked: false, deleted: false,
      createdAt: '2026-06-02T08:00:00.000Z', updatedAt: '2026-06-02T08:00:00.000Z',
      likes: ['u_kito', 'u_lena'], ratings: { u_kito: 5, u_lena: 4 },
      comments: [{ id: 'c_1', userId: 'u_kito', body: 'This needs to be read by everyone.', createdAt: '2026-06-02T10:00:00.000Z', parentId: null }],
    },
    {
      id: 's_2', authorId: 'u_kito', title: 'Six A.M. at Marikiti', type: 'documentary', privacy: 'public',
      excerpt: 'Before the city wakes, the market already has a rhythm of its own.',
      body: '<p>Marikiti market starts before the buses do. By four the porters are already moving crates.</p>',
      coverImage: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&h=700&fit=crop',
      files: [{ name: 'production-notes.pdf', url: '#' }], mediaBlocked: false, deleted: false,
      createdAt: '2026-06-10T06:30:00.000Z', updatedAt: '2026-06-10T06:30:00.000Z',
      likes: ['u_amara'], ratings: { u_amara: 5 }, comments: [],
    },
    {
      id: 's_3', authorId: 'u_lena', title: 'What the Amber Keeps', type: 'story', privacy: 'public',
      excerpt: 'My grandmother crossed the border with one bag.',
      body: '<p>There is a photograph of my grandmother at nineteen.</p>',
      coverImage: 'https://images.unsplash.com/photo-1520962880247-cfaf541c8724?w=1200&h=700&fit=crop',
      files: [], mediaBlocked: false, deleted: false,
      createdAt: '2026-06-18T14:00:00.000Z', updatedAt: '2026-06-18T14:00:00.000Z',
      likes: [], ratings: {}, comments: [],
    },
  ],
  follows: {},
  reports: [],
  admins: [],
  adminLogs: [],
};

function loadLocal() {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through */ }
  return { ...SEED, users: [...SEED.users], stories: [...SEED.stories] };
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

export function StoreProvider({ children }) {
  const [data, setData] = useState(SEED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (USE_API) {
      loadFromAPI();
    } else {
      setData(loadLocal());
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!USE_API && ready && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, ready]);

  async function loadFromAPI() {
    try {
      const res = await api('/stories');
      setData(d => ({ ...d, stories: res.stories || [] }));
    } catch (e) {
      console.error('Failed to load from API, using local fallback:', e);
      setData(loadLocal());
    }
    setReady(true);
  }

  // --- All operations work on local state, synced to API when available ---

  const upsertUser = useCallback((profile) => {
    setData(d => {
      const exists = d.users.find(u => u.id === profile.id);
      return {
        ...d,
        users: exists
          ? d.users.map(u => u.id === profile.id ? { ...u, ...profile } : u)
          : [...d.users, profile],
      };
    });
    if (USE_API) {
      api('/users/me', { method: 'PATCH', body: JSON.stringify({
        publisherName: profile.publisherName, logoUrl: profile.logoUrl,
        bio: profile.bio, socialLink: profile.socialLink,
      })}).catch(e => console.error('API upsert failed:', e));
    }
  }, []);

  const createStory = useCallback((story) => {
    const id = uid('s');
    const newStory = {
      id, likes: [], ratings: {}, comments: [], files: [],
      mediaBlocked: false, deleted: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      ...story,
    };
    setData(d => ({ ...d, stories: [newStory, ...d.stories] }));
    if (USE_API) {
      api('/stories', { method: 'POST', body: JSON.stringify(story) })
        .then(res => {
          setData(d => ({ ...d, stories: d.stories.map(s => s.id === id ? { ...s, id: res.id } : s) }));
        }).catch(e => console.error('API create failed:', e));
    }
    return id;
  }, []);

  const updateStory = useCallback((id, patch) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s => s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s),
    }));
    if (USE_API) {
      api(`/stories/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
        .catch(e => console.error('API update failed:', e));
    }
  }, []);

  const deleteStory = useCallback((id) => {
    setData(d => ({ ...d, stories: d.stories.map(s => s.id === id ? { ...s, deleted: true } : s) }));
    if (USE_API) {
      api(`/stories/${id}`, { method: 'DELETE' }).catch(e => console.error('API delete failed:', e));
    }
  }, []);

  const toggleLike = useCallback((storyId, userId) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s => {
        if (s.id !== storyId) return s;
        const has = s.likes.includes(userId);
        return { ...s, likes: has ? s.likes.filter(id => id !== userId) : [...s.likes, userId] };
      }),
    }));
    if (USE_API) {
      api(`/stories/${storyId}/like`, { method: 'POST' }).catch(e => console.error(e));
    }
  }, []);

  const rateStory = useCallback((storyId, userId, score) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s => s.id === storyId ? { ...s, ratings: { ...s.ratings, [userId]: score } } : s),
    }));
    if (USE_API) {
      api(`/stories/${storyId}/rate`, { method: 'POST', body: JSON.stringify({ score }) }).catch(e => console.error(e));
    }
  }, []);

  const addComment = useCallback((storyId, comment) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s =>
        s.id === storyId
          ? { ...s, comments: [...s.comments, { id: uid('c'), createdAt: new Date().toISOString(), parentId: null, ...comment }] }
          : s
      ),
    }));
    if (USE_API) {
      api(`/stories/${storyId}/comments`, { method: 'POST', body: JSON.stringify({ body: comment.body, parentId: comment.parentId }) })
        .catch(e => console.error(e));
    }
  }, []);

  const toggleFollow = useCallback((userId, publisherId) => {
    setData(d => {
      const current = d.follows[userId] || [];
      const has = current.includes(publisherId);
      return { ...d, follows: { ...d.follows, [userId]: has ? current.filter(id => id !== publisherId) : [...current, publisherId] } };
    });
    if (USE_API) {
      api(`/users/${publisherId}/follow`, { method: 'POST' }).catch(e => console.error(e));
    }
  }, []);

  const reportStory = useCallback((storyId, reporterId, reason) => {
    setData(d => ({ ...d, reports: [...d.reports, { id: uid('r'), storyId, reporterId, reason, resolved: false, createdAt: new Date().toISOString() }] }));
    if (USE_API) {
      api(`/stories/${storyId}/report`, { method: 'POST', body: JSON.stringify({ reason }) }).catch(e => console.error(e));
    }
  }, []);

  const resolveReport = useCallback((reportId) => {
    setData(d => ({ ...d, reports: d.reports.map(r => r.id === reportId ? { ...r, resolved: true } : r) }));
  }, []);

  const logAdminAction = useCallback((actorEmail, action, target) => {
    setData(d => ({ ...d, adminLogs: [{ id: uid('log'), actorEmail, action, target, timestamp: new Date().toISOString() }, ...d.adminLogs] }));
  }, []);

  const setUserSuspended = useCallback((userId, suspended, actorEmail) => {
    setData(d => ({ ...d, users: d.users.map(u => u.id === userId ? { ...u, suspended } : u) }));
    logAdminAction(actorEmail, suspended ? 'suspend_user' : 'unsuspend_user', userId);
  }, [logAdminAction]);

  const setMediaBlocked = useCallback((storyId, blocked, actorEmail) => {
    setData(d => ({ ...d, stories: d.stories.map(s => s.id === storyId ? { ...s, mediaBlocked: blocked } : s) }));
    logAdminAction(actorEmail, blocked ? 'block_media' : 'unblock_media', storyId);
  }, [logAdminAction]);

  const adminDeleteStory = useCallback((storyId, actorEmail) => {
    deleteStory(storyId);
    logAdminAction(actorEmail, 'delete_post', storyId);
  }, [deleteStory, logAdminAction]);

  const addAdmin = useCallback((email, actorEmail) => {
    setData(d => d.admins.includes(email) ? d : { ...d, admins: [...d.admins, email] });
    logAdminAction(actorEmail, 'add_admin', email);
  }, [logAdminAction]);

  const removeAdmin = useCallback((email, actorEmail) => {
    setData(d => ({ ...d, admins: d.admins.filter(e => e !== email) }));
    logAdminAction(actorEmail, 'remove_admin', email);
  }, [logAdminAction]);

  const isEmailAdmin = useCallback((email) => email === 'adipotech@gmail.com' || data.admins.includes(email), [data.admins]);

  const value = useMemo(() => ({
    ...data, ready, upsertUser, createStory, updateStory, deleteStory,
    toggleLike, rateStory, addComment, toggleFollow, reportStory, resolveReport,
    setUserSuspended, setMediaBlocked, adminDeleteStory, addAdmin, removeAdmin, isEmailAdmin,
  }), [data, ready]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}