'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

let adminPin = '1234';
export function setAdminPin(pin) { adminPin = pin; }

const StoreContext = createContext(null);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const STORAGE_KEY = 'op_store_v1';
const USE_API = !!API_BASE;

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

const SEED = {
  users: [
    { id: 'u_amara', email: 'amara.okoye@example.com', name: 'Amara Okoye', publisherName: 'Amara Okoye', logoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop', bio: 'Independent journalist covering land rights across the Rift Valley.', role: 'user', suspended: false, createdAt: '2025-11-02T09:00:00.000Z' },
    { id: 'u_kito', email: 'kito.films@example.com', name: 'Kito Wanjala', publisherName: 'Kito Wanjala Films', logoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop', bio: 'Documentary maker. Streets, markets, the people who run them.', role: 'user', suspended: false, createdAt: '2025-11-10T09:00:00.000Z' },
    { id: 'u_lena', email: 'lena.p@example.com', name: 'Lena Petrova', publisherName: 'Lena Petrova', logoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop', bio: 'Writing about migration, memory, and the Baltic coast.', role: 'user', suspended: false, createdAt: '2025-12-01T09:00:00.000Z' },
  ],
  stories: [
    { id: 's_1', authorId: 'u_amara', title: 'The Fence Line', type: 'story', privacy: 'public', excerpt: 'A survey company drew a line through three villages. Nobody asked who was on which side.', body: '<p>The surveyors arrived on a Tuesday, in a truck with government plates and no explanation.</p><p>By Thursday there was a line of orange stakes running through Mama Achieng\'s sorghum field.</p>', coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&h=700&fit=crop', files: [], mediaBlocked: false, deleted: false, createdAt: '2026-06-02T08:00:00.000Z', updatedAt: '2026-06-02T08:00:00.000Z', likes: ['u_kito', 'u_lena'], ratings: { u_kito: 5, u_lena: 4 }, comments: [{ id: 'c_1', userId: 'u_kito', body: 'This needs to be read by everyone on that district council.', createdAt: '2026-06-02T10:00:00.000Z', parentId: null }] },
    { id: 's_2', authorId: 'u_kito', title: 'Six A.M. at Marikiti', type: 'documentary', privacy: 'public', excerpt: 'Before the city wakes, the market already has a rhythm of its own — a short documentary.', body: '<p>Marikiti market starts before the buses do. By four the porters are already moving crates, and by six the first buyers are haggling under lamps that haven\'t been switched off yet.</p>', coverImage: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&h=700&fit=crop', files: [{ name: 'production-notes.pdf', url: '#' }], mediaBlocked: false, deleted: false, createdAt: '2026-06-10T06:30:00.000Z', updatedAt: '2026-06-10T06:30:00.000Z', likes: ['u_amara'], ratings: { u_amara: 5 }, comments: [] },
    { id: 's_3', authorId: 'u_lena', title: 'What the Amber Keeps', type: 'story', privacy: 'public', excerpt: 'My grandmother crossed the border with one bag. Sixty years later I went looking for what she left behind.', body: '<p>There is a photograph of my grandmother at nineteen, standing outside a house that, as far as I can tell, no longer exists.</p>', coverImage: 'https://images.unsplash.com/photo-1520962880247-cfaf541c8724?w=1200&h=700&fit=crop', files: [], mediaBlocked: false, deleted: false, createdAt: '2026-06-18T14:00:00.000Z', updatedAt: '2026-06-18T14:00:00.000Z', likes: [], ratings: {}, comments: [] },
  ],
  follows: {},
  reports: [],
  admins: [],
  adminLogs: [],
};

function loadLocal() {
  if (typeof window === 'undefined') return JSON.parse(JSON.stringify(SEED));
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* corrupt storage — fall through */ }
  return JSON.parse(JSON.stringify(SEED));
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (path.startsWith('/admin') && adminPin) {
    headers['X-Admin-Pin'] = adminPin;
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

export function StoreProvider({ children }) {
  const [data, setData] = useState(SEED);
  const [ready, setReady] = useState(false);

  // Initialize data
  useEffect(() => {
    if (USE_API) {
      loadFromAPI();
    } else {
      setData(loadLocal());
      setReady(true);
    }
  }, []);

  // Persist to localStorage in dev mode
  useEffect(() => {
    if (!USE_API && ready && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, ready]);

  async function loadFromAPI() {
    try {
      const [storiesRes] = await Promise.all([
        api('/stories'),
      ]);
      setData(d => ({
        ...d,
        stories: (storiesRes.stories || []).map(s => normalizeStory(s)),
      }));
    } catch (e) {
      console.error('Failed to load from API, using local fallback:', e);
      setData(loadLocal());
    }
    setReady(true);
  }

  // Normalize backend field names to frontend camelCase
  function normalizeStory(s) {
    return {
      id: s.id,
      authorId: s.author_id,
      title: s.title,
      excerpt: s.excerpt || '',
      body: s.body,
      type: s.type || 'story',
      privacy: s.privacy || 'public',
      coverImage: s.cover_image || null,
      files: (s.files || []).map(f => ({ name: f.name, url: f.url })),
      likes: s.likes || [],
      ratings: s.ratings || {},
      comments: (s.comments || []).map(c => ({
        id: c.id,
        userId: c.user_id,
        body: c.body,
        parentId: c.parent_id || null,
        createdAt: c.created_at,
      })),
      mediaBlocked: !!s.media_blocked,
      deleted: !!s.deleted,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    };
  }

  // ===== USER OPERATIONS =====

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
      api('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          publisherName: profile.publisherName,
          logoUrl: profile.logoUrl,
          bio: profile.bio,
          socialLink: profile.socialLink,
        }),
      }).catch(e => console.error('API upsertUser failed:', e));
    }
  }, []);

  // ===== STORY OPERATIONS =====

  const createStory = useCallback((story) => {
    const id = uid('s');
    const newStory = {
      id,
      authorId: story.authorId,
      title: story.title,
      excerpt: story.excerpt || '',
      body: story.body,
      type: story.type || 'story',
      privacy: story.privacy || 'public',
      coverImage: story.coverImage || null,
      files: story.files || [],
      likes: [],
      ratings: {},
      comments: [],
      mediaBlocked: false,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setData(d => ({ ...d, stories: [newStory, ...d.stories] }));
    if (USE_API) {
      api('/stories', {
        method: 'POST',
        body: JSON.stringify({
          title: story.title,
          excerpt: story.excerpt,
          body: story.body,
          type: story.type,
          privacy: story.privacy,
          coverImage: story.coverImage,
          files: story.files,
        }),
      })
        .then(res => {
          // Update local id to match backend id
          setData(d => ({
            ...d,
            stories: d.stories.map(s => s.id === id ? { ...s, id: res.id } : s),
          }));
        })
        .catch(e => console.error('API createStory failed:', e));
    }
    return id;
  }, []);

  const updateStory = useCallback((id, patch) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
      ),
    }));
    if (USE_API) {
      api(`/stories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }).catch(e => console.error('API updateStory failed:', e));
    }
  }, []);

  const deleteStory = useCallback((id) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s => s.id === id ? { ...s, deleted: true } : s),
    }));
    if (USE_API) {
      api(`/stories/${id}`, { method: 'DELETE' })
        .catch(e => console.error('API deleteStory failed:', e));
    }
  }, []);

  // ===== ENGAGEMENT =====

  const toggleLike = useCallback((storyId, userId) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s => {
        if (s.id !== storyId) return s;
        const has = s.likes.includes(userId);
        return {
          ...s,
          likes: has ? s.likes.filter(id => id !== userId) : [...s.likes, userId],
        };
      }),
    }));
    if (USE_API) {
      api(`/stories/${storyId}/like`, { method: 'POST' })
        .catch(e => console.error('API toggleLike failed:', e));
    }
  }, []);

  const rateStory = useCallback((storyId, userId, score) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s =>
        s.id === storyId
          ? { ...s, ratings: { ...s.ratings, [userId]: score } }
          : s
      ),
    }));
    if (USE_API) {
      api(`/stories/${storyId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ score }),
      }).catch(e => console.error('API rateStory failed:', e));
    }
  }, []);

  const addComment = useCallback((storyId, comment) => {
    const newComment = {
      id: uid('c'),
      userId: comment.userId,
      body: comment.body,
      parentId: comment.parentId || null,
      createdAt: new Date().toISOString(),
    };
    setData(d => ({
      ...d,
      stories: d.stories.map(s =>
        s.id === storyId
          ? { ...s, comments: [...s.comments, newComment] }
          : s
      ),
    }));
    if (USE_API) {
      api(`/stories/${storyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          body: comment.body,
          parentId: comment.parentId || null,
        }),
      })
        .then(res => {
          setData(d => ({
            ...d,
            stories: d.stories.map(s =>
              s.id === storyId
                ? {
                    ...s,
                    comments: s.comments.map(c =>
                      c.id === newComment.id ? { ...c, id: res.id } : c
                    ),
                  }
                : s
            ),
          }));
        })
        .catch(e => console.error('API addComment failed:', e));
    }
  }, []);

  const toggleFollow = useCallback((userId, publisherId) => {
    setData(d => {
      const current = d.follows[userId] || [];
      const has = current.includes(publisherId);
      return {
        ...d,
        follows: {
          ...d.follows,
          [userId]: has
            ? current.filter(id => id !== publisherId)
            : [...current, publisherId],
        },
      };
    });
    if (USE_API) {
      api(`/users/${publisherId}/follow`, { method: 'POST' })
        .catch(e => console.error('API toggleFollow failed:', e));
    }
  }, []);

  const reportStory = useCallback((storyId, reporterId, reason) => {
    const newReport = {
      id: uid('r'),
      storyId,
      reporterId,
      reason,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    setData(d => ({ ...d, reports: [...d.reports, newReport] }));
    if (USE_API) {
      api(`/stories/${storyId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }).catch(e => console.error('API reportStory failed:', e));
    }
  }, []);

  // ===== ADMIN OPERATIONS =====

  const logAdminAction = useCallback((actorEmail, action, target) => {
    setData(d => ({
      ...d,
      adminLogs: [
        { id: uid('log'), actorEmail, action, target, timestamp: new Date().toISOString() },
        ...d.adminLogs,
      ],
    }));
  }, []);

  const resolveReport = useCallback((reportId) => {
    setData(d => ({
      ...d,
      reports: d.reports.map(r => r.id === reportId ? { ...r, resolved: true } : r),
    }));
    if (USE_API) {
      api(`/admin/reports/${reportId}/resolve`, { method: 'POST' })
        .catch(e => console.error('API resolveReport failed:', e));
    }
  }, []);

  const setUserSuspended = useCallback((userId, suspended, actorEmail) => {
    setData(d => ({
      ...d,
      users: d.users.map(u => u.id === userId ? { ...u, suspended } : u),
    }));
    logAdminAction(actorEmail, suspended ? 'suspend_user' : 'unsuspend_user', userId);
    if (USE_API) {
      const endpoint = suspended ? 'suspend' : 'unsuspend';
      api(`/admin/users/${userId}/${endpoint}`, { method: 'POST' })
        .catch(e => console.error('API setUserSuspended failed:', e));
    }
  }, [logAdminAction]);

  const setMediaBlocked = useCallback((storyId, blocked, actorEmail) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s => s.id === storyId ? { ...s, mediaBlocked: blocked } : s),
    }));
    logAdminAction(actorEmail, blocked ? 'block_media' : 'unblock_media', storyId);
    if (USE_API) {
      const endpoint = blocked ? 'block-media' : 'unblock-media';
      api(`/admin/stories/${storyId}/${endpoint}`, { method: 'POST' })
        .catch(e => console.error('API setMediaBlocked failed:', e));
    }
  }, [logAdminAction]);

  // Admin delete — uses admin endpoint directly, NOT the user delete endpoint
  const adminDeleteStory = useCallback((storyId, actorEmail) => {
    setData(d => ({
      ...d,
      stories: d.stories.map(s => s.id === storyId ? { ...s, deleted: true } : s),
    }));
    logAdminAction(actorEmail, 'delete_post', storyId);
    if (USE_API) {
      api(`/admin/stories/${storyId}`, { method: 'DELETE' })
        .catch(e => console.error('API adminDeleteStory failed:', e));
    }
  }, [logAdminAction]);

  const addAdmin = useCallback((email, actorEmail) => {
    setData(d => ({
      ...d,
      admins: d.admins.includes(email) ? d.admins : [...d.admins, email],
    }));
    logAdminAction(actorEmail, 'add_admin', email);
    if (USE_API) {
      api('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }).catch(e => console.error('API addAdmin failed:', e));
    }
  }, [logAdminAction]);

  const removeAdmin = useCallback((email, actorEmail) => {
    setData(d => ({
      ...d,
      admins: d.admins.filter(e => e !== email),
    }));
    logAdminAction(actorEmail, 'remove_admin', email);
    if (USE_API) {
      api(`/admin/admins/${email}`, { method: 'DELETE' })
        .catch(e => console.error('API removeAdmin failed:', e));
    }
  }, [logAdminAction]);

  const isEmailAdmin = useCallback(
    (email) => email === 'adipotech@gmail.com' || data.admins.includes(email),
    [data.admins]
  );

  // ===== CONTEXT VALUE =====

  const value = useMemo(() => ({
    users: data.users,
    stories: data.stories,
    follows: data.follows,
    reports: data.reports,
    admins: data.admins,
    adminLogs: data.adminLogs,
    ready,
    upsertUser,
    createStory,
    updateStory,
    deleteStory,
    toggleLike,
    rateStory,
    addComment,
    toggleFollow,
    reportStory,
    resolveReport,
    setUserSuspended,
    setMediaBlocked,
    adminDeleteStory,
    addAdmin,
    removeAdmin,
    isEmailAdmin,
  }), [
    data, ready,
    upsertUser, createStory, updateStory, deleteStory,
    toggleLike, rateStory, addComment, toggleFollow,
    reportStory, resolveReport,
    setUserSuspended, setMediaBlocked, adminDeleteStory,
    addAdmin, removeAdmin, isEmailAdmin,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}