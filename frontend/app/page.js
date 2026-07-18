'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import StoryCard from '../components/StoryCard';

export default function HomePage() {
  const { stories, ready } = useStore();
  const [filter, setFilter] = useState('all');

  const visible = useMemo(() => {
    return stories
      .filter((s) => !s.deleted && s.privacy === 'public')
      .filter((s) => {
  if (filter === 'all') return true;
  if (filter === 'news') return s.authorId === 'u_newsdesk';
  return s.type === filter;
})
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [stories, filter]);

  return (
    <div>
      <section className="border-b border-wire">
        <div className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
          <p className="wire-tag mb-4">Vol. 1 — Every voice, a masthead</p>
          <h1 className="editorial-h text-4xl sm:text-6xl font-black leading-[1.05] max-w-3xl">
            Tell your story. Put your name on it. Build the audience that follows it.
          </h1>
          <p className="text-ink-600 max-w-xl mt-5 text-base sm:text-lg">
            OpinionPlus gives every writer and filmmaker their own masthead — logo, byline, and a
            page that&apos;s unmistakably theirs — plus the feed, comments, and ratings to build a
            readership around it.
          </p>
          <div className="flex gap-3 mt-8">
            <Link href="/publish" className="btn-primary px-5 py-3 rounded-sm text-sm">
              Publish your story
            </Link>
            <Link href="/about" className="btn-outline px-5 py-3 rounded-sm text-sm">
              Read the mission
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-12">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="editorial-h text-2xl font-bold">The feed</h2>
          <div className="flex gap-2 text-xs font-semibold">
            {['all', 'story', 'documentary', 'news'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full border ${
                  filter === f ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'
                }`}
              >
                {f === 'all' ? 'All' : f === 'story' ? 'Stories' : f === 'documentary' ? 'Documentaries' : 'News'}
              </button>
            ))}
          </div>
        </div>

        {!ready ? (
          <p className="text-ink-400 text-sm">Loading the feed…</p>
        ) : visible.length === 0 ? (
          <div className="border border-dashed border-wire rounded-sm p-12 text-center">
            <p className="editorial-h text-xl font-bold mb-2">Nothing published yet.</p>
            <p className="text-sm text-ink-400 mb-4">Be the first byline on this page.</p>
            <Link href="/publish" className="btn-primary px-4 py-2 rounded-sm text-sm inline-block">
              Publish your story
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}