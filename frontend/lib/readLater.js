const KEY = 'op_read_later';

export function getReadLater() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function addToReadLater(story) {
  const list = getReadLater().filter(s => s.id !== story.id);
  list.unshift({
    id: story.id,
    title: story.title,
    excerpt: story.excerpt || '',
    authorName: story.authorName || '',
    coverImage: story.coverImage || null,
    addedAt: new Date().toISOString()
  });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  return list;
}

export function removeFromReadLater(storyId) {
  const list = getReadLater().filter(s => s.id !== storyId);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function isInReadLater(storyId) {
  return getReadLater().some(s => s.id === storyId);
}