'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const HISTORY_KEY = 'op_search_history';
const MAX_HISTORY = 10;

function getHistory() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function addToHistory(query) {
  const history = getHistory().filter(h => h !== query);
  history.unshift(query);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export default function SearchBar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/stories/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (e) { /* ignore */ }
      setLoading(false);
      setSelectedIndex(-1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (item) => {
    addToHistory(query || item.title);
    setOpen(false);
    setQuery('');
    window.location.href = `/story/${item.id}`;
  };

  const handleKeyDown = (e) => {
    if (!open) return;
    const items = query.length >= 2 ? results : history;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const item = items[selectedIndex];
      if (item.id) handleSelect(item);
      else { setQuery(item); setOpen(true); }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-1">
        <button onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 100); }}
          className="text-ink-400 hover:text-ink-600 transition-colors" title="Search">
          <Search size={17} />
        </button>
      </div>

      {open && (
        <div className="absolute top-10 right-0 w-80 sm:w-96 bg-paper border border-wire rounded-sm shadow-lg z-50">
          <div className="flex items-center gap-2 p-3 border-b border-wire">
            <Search size={14} className="text-ink-400 shrink-0" />
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown} placeholder="Search stories, news, documentaries..."
              className="flex-1 text-sm outline-none bg-transparent" autoFocus />
            {query && (
              <button onClick={() => setQuery('')} className="text-ink-400 hover:text-ink-600"><X size={14} /></button>
            )}
          </div>

          {loading && <p className="p-3 text-xs text-ink-400">Searching...</p>}

          {!loading && query.length >= 2 && results.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {results.map((item, i) => (
                <button key={item.id} onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-ink-50 flex items-start gap-3 border-b border-wire last:border-0 ${i === selectedIndex ? 'bg-ink-50' : ''}`}>
                  {item.cover_image && <img src={item.cover_image} alt="" className="w-10 h-10 rounded-sm object-cover shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-ink-400 capitalize">{item.type} · {item.author_id === 'u_newsdesk' ? 'News' : 'Story'}</p>
                  </div>
                  <ArrowRight size={14} className="text-ink-400 shrink-0 mt-1" />
                </button>
              ))}
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="p-3 text-xs text-ink-400">No results found for &quot;{query}&quot;</p>
          )}

          {!loading && query.length < 2 && history.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <span className="text-xs text-ink-400 flex items-center gap-1"><Clock size={11} /> Recent searches</span>
                <button onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-ink-400 hover:text-signal">Clear</button>
              </div>
              {history.map((item, i) => (
                <button key={i} onClick={() => { setQuery(item); inputRef.current?.focus(); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-ink-50 flex items-center gap-2 ${i === selectedIndex ? 'bg-ink-50' : ''}`}>
                  <Clock size={12} className="text-ink-400" /> {item}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}