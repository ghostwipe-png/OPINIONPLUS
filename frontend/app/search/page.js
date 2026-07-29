// app/search/page.js
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Loader2, Newspaper, ArrowRight, Heart, MessageCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const TYPE_BADGES = {
  story: 'bg-ink text-white',
  documentary: 'bg-purple-600 text-white',
  campus: 'bg-emerald-600 text-white',
  press_release: 'bg-blue-600 text-white',
  sponsored: 'bg-amber-500 text-[#0A0807]',
};

function AuthorAvatar({ name }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div className="w-6 h-6 rounded-full bg-ink-100 flex items-center justify-center text-[10px] font-bold text-ink shrink-0">
      {initial}
    </div>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchInput, setSearchInput] = useState(query);

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (q) => {
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(`${API_BASE}/stories/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      window.history.replaceState(null, '', `/search?q=${encodeURIComponent(searchInput.trim())}`);
      performSearch(searchInput.trim());
    }
  };

  return (
    <div className="min-h-screen bg-paper py-16 px-5">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-black text-ink uppercase tracking-tight flex items-center gap-3">
            <Search size={28} className="text-signal" /> Search
          </h1>
          <p className="text-sm text-ink-500 font-medium mt-2">
            Find stories, documentaries, press releases, and more across the platform.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-12">
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by keyword, topic, or publisher..."
              className="w-full border-2 border-wire rounded-sm px-5 py-4 text-lg font-bold bg-white focus:outline-none focus:border-ink transition-colors"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-ink text-white font-bold uppercase text-sm tracking-wider px-6 py-2.5 rounded-sm hover:bg-signal transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-wire/20 animate-pulse rounded-sm" />
            ))}
          </div>
        ) : hasSearched ? (
          results.length === 0 ? (
            <div className="border border-wire bg-white p-16 text-center rounded-sm">
              <Search size={40} className="text-ink-300 mx-auto mb-4" />
              <p className="text-xl font-black text-ink uppercase tracking-tight mb-2">No results found</p>
              <p className="text-sm text-ink-500">
                No stories match &quot;{query}&quot;. Try a different keyword or browse the feed.
              </p>
              <Link href="/" className="inline-flex items-center gap-2 mt-6 bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal transition-colors">
                Browse Feed <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400 mb-6">
                {results.length} result{results.length !== 1 ? 's' : ''} for &quot;{query}&quot;
              </p>
              <div className="space-y-3">
                {results.map(result => {
                  const authorName = result.author || result.publisher_name || 'OpinionPlus Staff';
                  const badgeClass = TYPE_BADGES[result.type] || TYPE_BADGES.story;
                  const likes = Array.isArray(result.likes) ? result.likes.length : (result.like_count ?? 0);
                  const comments = Array.isArray(result.comments) ? result.comments.length : (result.comment_count ?? 0);
                  return (
                    <Link
                      key={result.id}
                      href={`/story/${result.id}`}
                      className="block border border-wire bg-white p-5 rounded-sm hover:border-ink hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${badgeClass}`}>
                              {result.type?.replace('_', ' ') || 'Story'}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-ink group-hover:text-signal transition-colors line-clamp-1">
                            {result.title}
                          </h3>
                          <p className="text-xs text-ink-500 mt-1 line-clamp-2 leading-relaxed">
                            {result.excerpt || (typeof result.body === 'string' ? result.body.slice(0, 150) : '')}
                          </p>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="flex items-center gap-2">
                              <AuthorAvatar name={authorName} />
                              <span className="text-[11px] font-semibold text-ink-400">{authorName}</span>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] text-ink-300">
                              <Heart size={11} /> {likes}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-ink-300">
                              <MessageCircle size={11} /> {comments}
                            </span>
                          </div>
                        </div>
                        {result.cover_image && (
                          <img
                            src={result.cover_image}
                            alt=""
                            className="w-20 h-20 rounded-sm object-cover shrink-0 hidden sm:block"
                          />
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )
        ) : (
          <div className="border border-wire bg-white p-16 text-center rounded-sm">
            <Search size={40} className="text-ink-300 mx-auto mb-4" />
            <p className="text-xl font-black text-ink uppercase tracking-tight mb-2">Search the Platform</p>
            <p className="text-sm text-ink-500">
              Enter a keyword, topic, or publisher name to find stories across OPINIONPLUS.
            </p>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-wire">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-ink hover:text-signal transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="animate-spin text-signal" size={32} />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}