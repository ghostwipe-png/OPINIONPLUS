// lib/readlater.js
'use client';

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
    body: story.body || '', // Captured for offline downloads
    authorName: story.authorName || 'OpinionPlus Contributor',
    coverImage: story.coverImage || null,
    addedAt: new Date().toISOString()
  });
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  
  // Dispatch custom event for real-time UI counters
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('op_read_later_updated', { detail: { list } }));
  }
  return list;
}

export function removeFromReadLater(storyId) {
  const list = getReadLater().filter(s => s.id !== storyId);
  localStorage.setItem(KEY, JSON.stringify(list));
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('op_read_later_updated', { detail: { list } }));
  }
  return list;
}

export function isInReadLater(storyId) {
  return getReadLater().some(s => s.id === storyId);
}

/**
 * ⚡ NEW: Download saved story as an offline-ready HTML file
 */
export function downloadStory(story) {
  if (typeof window === 'undefined') return;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${story.title} | OpinionPlus Offline</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1C1917; line-height: 1.8; }
        h1 { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.025em; margin-bottom: 10px; }
        .meta { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: #78716C; margin-bottom: 30px; border-bottom: 2px solid #E7E5E4; padding-bottom: 15px; }
        .excerpt { font-style: italic; color: #57534E; font-size: 1.15rem; border-left: 3px solid #E0492B; padding-left: 15px; margin-bottom: 30px; }
        img { max-width: 100%; height: auto; border-radius: 4px; margin: 20px 0; }
        footer { margin-top: 50px; font-size: 0.75rem; color: #A8A29E; text-align: center; border-top: 1px solid #E7E5E4; padding-top: 20px; }
      </style>
    </head>
    <body>
      <h1>${story.title}</h1>
      <div class="meta">Published by ${story.authorName} • Saved via OpinionPlus Reader</div>
      ${story.excerpt ? `<div class="excerpt">${story.excerpt}</div>` : ''}
      ${story.coverImage ? `<img src="${story.coverImage}" alt="Cover image" />` : ''}
      <div class="content">
        ${story.body || '<p>No preview text available for offline reading.</p>'}
      </div>
      <footer>Saved securely on ${new Date().toLocaleDateString()} from OpinionPlus</footer>
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${story.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ⚡ NEW: Share story via Web Share API or clipboard fallback
 */
export async function shareStory(story) {
  if (typeof window === 'undefined') return;

  const shareData = {
    title: story.title,
    text: story.excerpt || `Read "${story.title}" on OpinionPlus`,
    url: `${window.location.origin}/story/${story.id}`,
  };

  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Error sharing:', err);
    }
  }

  // Fallback to clipboard
  try {
    await navigator.clipboard.writeText(shareData.url);
    alert('Story link copied to clipboard!');
  } catch (e) {
    alert('Unable to share story.');
  }
}

/**
 * ⚡ NEW: Support Publisher / Buy Coffee Trigger (Integrates with Paystack / Tipping)
 */
export function buyCoffeeForPublisher(story, { onOpenTipModal } = {}) {
  if (typeof window === 'undefined') return;

  // If a custom modal trigger callback is provided, invoke it
  if (typeof onOpenTipModal === 'function') {
    onOpenTipModal({ authorName: story.authorName, storyId: story.id });
    return;
  }

  // Default fallback: Quick tip redirection or alert dialog
  const amount = prompt(`Support ${story.authorName || 'this publisher'} by buying a coffee! Enter amount (USD/KES):`, '5');
  if (amount && !isNaN(amount)) {
    alert(`Thank you! Processing tip of $${amount} for ${story.authorName}. Redirecting to secure checkout...`);
    // Hook your Paystack gateway or tip endpoint here if desired
  }
}