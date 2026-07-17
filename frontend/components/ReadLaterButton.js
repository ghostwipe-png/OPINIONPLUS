'use client';

import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { addToReadLater, removeFromReadLater, isInReadLater } from '../lib/readLater';

export default function ReadLaterButton({ story }) {
  const [saved, setSaved] = useState(isInReadLater(story.id));

  const toggle = () => {
    if (saved) {
      removeFromReadLater(story.id);
      setSaved(false);
    } else {
      addToReadLater(story);
      setSaved(true);
    }
  };

  return (
    <button
      onClick={toggle}
      title={saved ? 'Remove from Read Later' : 'Save for later'}
      className={`text-xs flex items-center gap-1 transition-colors ${saved ? 'text-signal' : 'text-ink-400 hover:text-ink-600'}`}
    >
      {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
      {saved ? 'Saved' : 'Read later'}
    </button>
  );
}