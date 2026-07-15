'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ROOT_ADMIN_EMAIL } from './auth';

const StoreContext = createContext(null);
const KEY = 'op_store_v1';

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

const SEED = {
  users: [
    {
      id: 'u_amara',
      email: 'amara.okoye@example.com',
      name: 'Amara Okoye',
      publisherName: 'Amara Okoye',
      logoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop',
      bio: 'Independent journalist covering land rights across the Rift Valley.',
      role: 'user',
      suspended: false,
      createdAt: '2025-11-02T09:00:00.000Z',
    },
    {
      id: 'u_kito',
      email: 'kito.films@example.com',
      name: 'Kito Wanjala',
      publisherName: 'Kito Wanjala Films',
      logoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
      bio: 'Documentary maker. Streets, markets, the people who run them.',
      role: 'user',
      suspended: false,
      createdAt: '2025-11-10T09:00:00.000Z',
    },
    {
      id: 'u_lena',
      email: 'lena.p@example.com',
      name: 'Lena Petrova',
      publisherName: 'Lena Petrova',
      logoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
      bio: 'Writing about migration, memory, and the Baltic coast.',
      role: 'user',
      suspended: false,
      createdAt: '2025-12-01T09:00:00.000Z',
    },
  ],
  stories: [
    {
      id: 's_1',
      authorId: 'u_amara',
      title: 'The Fence Line',
      type: 'story',
      privacy: 'public',
      excerpt: 'A survey company drew a line through three villages. Nobody asked who was on which side.',
      body: `The surveyors arrived on a Tuesday, in a truck with government plates and no explanation.\n\nBy Thursday there was a line of orange stakes running through Mama Achieng's sorghum field, through the Odhiambo family's grazing land, and straight through the middle of what used to be the shared path to the borehole.\n\nNo one from the district office could say, when asked, what the line was for. "Survey purposes," was the answer, repeated at every door. Three weeks later, the answer became clearer: a lease had been signed for a solar development, and the fence line was its boundary.\n\nThis is the story of what happened when a village found out it had been divided by a document none of them had seen.`,
      coverImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&h=700&fit=crop',
      files: [],
      mediaBlocked: false,
      deleted: false,
      createdAt: '2026-06-02T08:00:00.000Z',
      updatedAt: '2026-06-02T08:00:00.000Z',
      likes: ['u_kito', 'u_lena'],
      ratings: { u_kito: 5, u_lena: 4 },
      comments: [
        {
          id: 'c_1',
          userId: 'u_kito',
          body: 'This needs to be read by everyone on that district council.',
          createdAt: '2026-06-02T10:00:00.000Z',
          parentId: null,
        },
      ],
    },
    {
      id: 's_2',
      authorId: 'u_kito',
      title: 'Six A.M. at Marikiti',
      type: 'documentary',
      privacy: 'public',
      excerpt: 'Before the city wakes, the market already has a rhythm of its own — a short documentary.',
      body: `Marikiti market starts before the buses do. By four the porters are already moving crates, and by six the first buyers are haggling under lamps that haven't been switched off yet.\n\nI spent eleven mornings there with a camera, mostly staying out of the way. What struck me wasn't the noise — everyone warns you about the noise — it was the choreography. Nobody collides. Everyone has a lane, a rhythm, a place they've held for years.\n\nThis piece is an attempt to show that rhythm before it disappears under whatever comes next for that plot of land.`,
      coverImage: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&h=700&fit=crop',
      files: [{ name: 'production-notes.pdf', url: '#' }],
      mediaBlocked: false,
      deleted: false,
      createdAt: '2026-06-10T06:30:00.000Z',
      updatedAt: '2026-06-10T06:30:00.000Z',
      likes: ['u_amara'],
      ratings: { u_amara: 5 },
      comments: [],
    },
    {
      id: 's_3',
      authorId: 'u_lena',
      title: 'What the Amber Keeps',
      type: 'story',
      privacy: 'public',
      excerpt: 'My grandmother crossed the border with one bag. Sixty years later I went looking for what she left behind.',
      body: `There is a photograph of my grandmother at nineteen, standing outside a house that, as far as I can tell, no longer exists.\n\nI went back this spring to find the street. The street was there. The house had been replaced twice over, first by a block of flats in the seventies, then by a business selling amber jewellery to tourists — an irony that took me a full day to appreciate.\n\nThis is not really a story about a house. It's a story about what a family decides to carry, and what it decides, sometimes without discussion, to leave on the other side of a line on a map.`,
      coverImage: 'https://images.unsplash.com/photo-1520962880247-cfaf541c8724?w=1200&h=700&fit=crop',
      files: [],
      mediaBlocked: false,
      deleted: false,
      createdAt: '2026-06-18T14:00:00.000Z',
      updatedAt: '2026-06-18T14:00:00.000Z',
      likes: [],
      ratings: {},
      comments: [],
    },
  ],
  follows: {}, // userId -> [publisherId, ...]
  reports: [],
  admins: [], // emails granted admin by root (root itself is always implicit admin)
  adminLogs: [],
};

function load() {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    /* fall through to seed */
  }
  return SEED;
}

export function StoreProvider({ children }) {
  const [data, setData] = useState(SEED);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && typeof window !== 'undefined') {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    }
  }, [data, ready]);

  const upsertUser = useCallback((profile) => {
    setData((d) => {
      const exists = d.users.find((u) => u.id === profile.id);
      if (exists) {
        return {
          ...d,
          users: d.users.map((u) => (u.id === profile.id ? { ...u, ...profile } : u)),
        };
      }
      return { ...d, users: [...d.users, profile] };
    });
  }, []);

  const createStory = useCallback((story) => {
    const id = uid('s');
    setData((d) => ({
      ...d,
      stories: [
        {
          id,
          likes: [],
          ratings: {},
          comments: [],
          files: [],
          mediaBlocked: false,
          deleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...story,
        },
        ...d.stories,
      ],
    }));
    return id;
  }, []);

  const updateStory = useCallback((id, patch) => {
    setData((d) => ({
      ...d,
      stories: d.stories.map((s) =>
        s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s
      ),
    }));
  }, []);

  const deleteStory = useCallback((id) => {
    setData((d) => ({
      ...d,
      stories: d.stories.map((s) => (s.id === id ? { ...s, deleted: true } : s)),
    }));
  }, []);

  const toggleLike = useCallback((storyId, userId) => {
    setData((d) => ({
      ...d,
      stories: d.stories.map((s) => {
        if (s.id !== storyId) return s;
        const has = s.likes.includes(userId);
        return { ...s, likes: has ? s.likes.filter((id) => id !== userId) : [...s.likes, userId] };
      }),
    }));
  }, []);

  const rateStory = useCallback((storyId, userId, score) => {
    setData((d) => ({
      ...d,
      stories: d.stories.map((s) =>
        s.id === storyId ? { ...s, ratings: { ...s.ratings, [userId]: score } } : s
      ),
    }));
  }, []);

  const addComment = useCallback((storyId, comment) => {
    setData((d) => ({
      ...d,
      stories: d.stories.map((s) =>
        s.id === storyId
          ? {
              ...s,
              comments: [
                ...s.comments,
                { id: uid('c'), createdAt: new Date().toISOString(), parentId: null, ...comment },
              ],
            }
          : s
      ),
    }));
  }, []);

  const toggleFollow = useCallback((userId, publisherId) => {
    setData((d) => {
      const current = d.follows[userId] || [];
      const has = current.includes(publisherId);
      return {
        ...d,
        follows: {
          ...d.follows,
          [userId]: has ? current.filter((id) => id !== publisherId) : [...current, publisherId],
        },
      };
    });
  }, []);

  const reportStory = useCallback((storyId, reporterId, reason) => {
    setData((d) => ({
      ...d,
      reports: [
        ...d.reports,
        { id: uid('r'), storyId, reporterId, reason, resolved: false, createdAt: new Date().toISOString() },
      ],
    }));
  }, []);

  const resolveReport = useCallback((reportId) => {
    setData((d) => ({
      ...d,
      reports: d.reports.map((r) => (r.id === reportId ? { ...r, resolved: true } : r)),
    }));
  }, []);

  const logAdminAction = useCallback((actorEmail, action, target) => {
    setData((d) => ({
      ...d,
      adminLogs: [
        { id: uid('log'), actorEmail, action, target, timestamp: new Date().toISOString() },
        ...d.adminLogs,
      ],
    }));
  }, []);

  const setUserSuspended = useCallback(
    (userId, suspended, actorEmail) => {
      setData((d) => ({
        ...d,
        users: d.users.map((u) => (u.id === userId ? { ...u, suspended } : u)),
      }));
      logAdminAction(actorEmail, suspended ? 'suspend_user' : 'unsuspend_user', userId);
    },
    [logAdminAction]
  );

  const setMediaBlocked = useCallback(
    (storyId, blocked, actorEmail) => {
      setData((d) => ({
        ...d,
        stories: d.stories.map((s) => (s.id === storyId ? { ...s, mediaBlocked: blocked } : s)),
      }));
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
      setData((d) => (d.admins.includes(email) ? d : { ...d, admins: [...d.admins, email] }));
      logAdminAction(actorEmail, 'add_admin', email);
    },
    [logAdminAction]
  );

  const removeAdmin = useCallback(
    (email, actorEmail) => {
      setData((d) => ({ ...d, admins: d.admins.filter((e) => e !== email) }));
      logAdminAction(actorEmail, 'remove_admin', email);
    },
    [logAdminAction]
  );

  const isEmailAdmin = useCallback(
    (email) => email === ROOT_ADMIN_EMAIL || data.admins.includes(email),
    [data.admins]
  );

  const value = useMemo(
    () => ({
      ...data,
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
    }),
    [
      data,
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
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
