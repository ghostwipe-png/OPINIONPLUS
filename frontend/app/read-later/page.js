'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bookmark, X, BookOpen } from 'lucide-react';
import { getReadLater, removeFromReadLater } from '../../lib/readLater';

export default function ReadLaterPage() {
  const [stories, setStories] = useState([]);

  useEffect(() => {
    setStories(getReadLater());
  }, []);

  const remove = (id) => {
    setStories(removeFromReadLater(id));
  };

  if (!stories.length) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-24 text-center">
        <Bookmark size={40} className="mx-auto mb-4 text-ink-300" />
        <p className="editorial-h text-2xl font-bold mb-2">No saved stories</p>
        <p className="text-sm text-ink-400 mb-4">Stories you save for later will appear here.</p>
        <Link href="/" className="text-signal text-sm font-medium">Browse stories</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-12">
      <h1 className="editorial-h text-3xl font-bold mb-2 flex items-center gap-2">
        <Bookmark size={24} /> Read Later
      </h1>
      <p className="text-sm text-ink-400 mb-8">{stories.length} saved stor{stories.length === 1 ? 'y' : 'ies'}</p>

      <div className="space-y-3">
        {stories.map(story => (
          <div key={story.id} className="flex items-start gap-4 p-4 border border-wire rounded-sm hover:border-ink transition-colors">
            <Link href={`/story/${story.id}`} className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{story.title}</p>
              {story.excerpt && <p className="text-xs text-ink-400 mt-1 line-clamp-2">{story.excerpt}</p>}
              {story.authorName && <p className="text-xs text-ink-400 mt-1">By {story.authorName}</p>}
            </Link>
            <button onClick={() => remove(story.id)} className="shrink-0 text-ink-400 hover:text-signal">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}