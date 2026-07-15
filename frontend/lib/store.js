'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

const StoreContext = createContext(null);
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
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
  const [users, setUsers] = useState([]);
  const [stories, setStories] = useState([]);
  const [follows, setFollows] = useState({});
  const [reports, setReports] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [storiesRes] = await Promise.all([
        api('/stories'),
      ]);
      setStories(storiesRes.stories || []);
      // Users and follows loaded on demand
    } catch (e) {
      console.error('Failed to load initial data:', e);
    }
    setReady(true);
  }

  async function fetchUser(id) {
    try {
      const data = await api(`/users/${id}`);
      if (data.user) {
        setUsers(prev => {
          const exists = prev.find(u => u.id === id);
          if (exists) return prev.map(u => u.id === id ? { ...u, ...data.user } : u);
          return [...prev, data.user];
        });
      }
    } catch (e) {
      console.error('Fetch user failed:', e);
    }
  }

  const upsertUser = useCallback(async (profile) => {
    try {
      await api('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          publisherName: profile.publisherName,
          logoUrl: profile.logoUrl,
          bio: profile.bio,
          socialLink: profile.socialLink,
        }),
      });
      setUsers(prev => prev.map(u => u.id === profile.id ? { ...u, ...profile } : u));
    } catch (e) {
      console.error('Update profile failed:', e);
    }
  }, []);

  const createStory = useCallback(async (story) => {
    try {
      const data = await api('/stories', {
        method: 'POST',
        body: JSON.stringify(story),
      });
      const newStory = {
        id: data.id,
        authorId: story.authorId,
        title: story.title,
        excerpt: story.excerpt,
        body: story.body,
        type: story.type,
        privacy: story.privacy,
        coverImage: story.coverImage,
        files: story.files || [],
        likes: [],
        ratings: {},
        comments: [],
        mediaBlocked: false,
        deleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setStories(prev => [newStory, ...prev]);
      return data.id;
    } catch (e) {
      console.error('Create story failed:', e);
      return null;
    }
  }, []);

  const updateStory = useCallback(async (id, patch) => {
    try {
      await api(`/stories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setStories(prev =>
        prev.map(s => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s))
      );
    } catch (e) {
      console.error('Update story failed:', e);
    }
  }, []);

  const deleteStory = useCallback(async (id) => {
    try {
      await api(`/stories/${id}`, { method: 'DELETE' });
      setStories(prev => prev.map(s => (s.id === id ? { ...s, deleted: true } : s)));
    } catch (e) {
      console.error('Delete story failed:', e);
    }
  }, []);

  const toggleLike = useCallback(async (storyId, userId) => {
    try {
      const data = await api(`/stories/${storyId}/like`, { method: 'POST' });
      setStories(prev =>
        prev.map(s => {
          if (s.id !== storyId) return s;
          const has = s.likes.includes(userId);
          return {
            ...s,
            likes: data.liked ? [...s.likes, userId] : s.likes.filter(id => id !== userId),
          };
        })
      );
    } catch (e) {
      console.error('Like failed:', e);
    }
  }, []);

  const rateStory = useCallback(async (storyId, userId, score) => {
    try {
      await api(`/stories/${storyId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ score }),
      });
      setStories(prev =>
        prev.map(s =>
          s.id === storyId ? { ...s, ratings: { ...s.ratings, [userId]: score } } : s
        )
      );
    } catch (e) {
      console.error('Rate failed:', e);
    }
  }, []);

  const addComment = useCallback(async (storyId, comment) => {
    try {
      const data = await api(`/stories/${storyId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: comment.body, parentId: comment.parentId }),
      });
      setStories(prev =>
        prev.map(s =>
          s.id === storyId
            ? {
                ...s,
                comments: [
                  ...s.comments,
                  {
                    id: data.id,
                    userId: comment.userId,
                    body: comment.body,
                    parentId: comment.parentId || null,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : s
        )
      );
    } catch (e) {
      console.error('Comment failed:', e);
    }
  }, []);

  const toggleFollow = useCallback(async (userId, publisherId) => {
    try {
      const data = await api(`/users/${publisherId}/follow`, { method: 'POST' });
      setFollows(prev => {
        const current = prev[userId] || [];
        const has = current.includes(publisherId);
        return {
          ...prev,
          [userId]: data.following
            ? [...current, publisherId]
            : current.filter(id => id !== publisherId),
        };
      });
    } catch (e) {
      console.error('Follow failed:', e);
    }
  }, []);

  const reportStory = useCallback(async (storyId, reporterId, reason) => {
    try {
      await api(`/stories/${storyId}/report`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setReports(prev => [
        ...prev,
        { id: uid('r'), storyId, reporterId, reason, resolved: false, createdAt: new Date().toISOString() },
      ]);
    } catch (e) {
      console.error('Report failed:', e);
    }
  }, []);

  const resolveReport = useCallback((reportId) => {
    setReports(prev => prev.map(r => (r.id === reportId ? { ...r, resolved: true } : r)));
  }, []);

  const logAdminAction = useCallback((actorEmail, action, target) => {
    setAdminLogs(prev => [
      { id: uid('log'), actorEmail, action, target, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const setUserSuspended = useCallback(
    (userId, suspended, actorEmail) => {
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, suspended } : u)));
      logAdminAction(actorEmail, suspended ? 'suspend_user' : 'unsuspend_user', userId);
    },
    [logAdminAction]
  );

  const setMediaBlocked = useCallback(
    (storyId, blocked, actorEmail) => {
      setStories(prev => prev.map(s => (s.id === storyId ? { ...s, mediaBlocked: blocked } : s)));
      logAdminAction(actorEmail, blocked ? 'block_media' : 'unblock_media', storyId);
    },
    [logAdminAction]
  );

  const adminDeleteStory = useCallback(
    (storyId, actorEmail) => {
      deleteStory(storyId);
      logAdminAction(actorEmail, 'delete_post', storyId);
    },
    [deleteStory, logAdminAction]
  );

  const addAdmin = useCallback(
    (email, actorEmail) => {
      setAdmins(prev => (prev.includes(email) ? prev : [...prev, email]));
      logAdminAction(actorEmail, 'add_admin', email);
    },
    [logAdminAction]
  );

  const removeAdmin = useCallback(
    (email, actorEmail) => {
      setAdmins(prev => prev.filter(e => e !== email));
      logAdminAction(actorEmail, 'remove_admin', email);
    },
    [logAdminAction]
  );

  const isEmailAdmin = useCallback(
    (email) => email === 'adipotech@gmail.com' || admins.includes(email),
    [admins]
  );

  const value = useMemo(
    () => ({
      users,
      stories,
      follows,
      reports,
      admins,
      adminLogs,
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
      fetchUser,
    }),
    [
      users, stories, follows, reports, admins, adminLogs, ready,
      upsertUser, createStory, updateStory, deleteStory,
      toggleLike, rateStory, addComment, toggleFollow,
      reportStory, resolveReport, setUserSuspended, setMediaBlocked,
      adminDeleteStory, addAdmin, removeAdmin, isEmailAdmin,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}