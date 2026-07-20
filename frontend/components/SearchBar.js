'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
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
  const abortControllerRef = useRef(null);
  const pathname = usePathname();

  // Close search when navigating to a new route
  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [pathname]);

  // Load history on mount
  useEffect(() => {
    if (open) setHistory(getHistory());
  }, [open]);

  // Handle outside click safely
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Debounced search with Request Cancellation
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      return;
    }

    setLoading(true);
    setSelectedIndex(-1);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/stories/search?q=${encodeURIComponent(query.trim())}`, {
          signal: abortControllerRef.current.signal
        });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.results || []);
      } catch (e) {
        if (e.name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback((item) => {
    const term = item.id ? item.title : item;
    addToHistory(term);
    setOpen(false);
    setQuery('');
    if (item.id) {
      window.location.href = `/story/${item.id}`;
    } else {
      setQuery(term);
      inputRef.current?.focus();
    }
  }, []);

  const handleKeyDown = (e) => {
    if (!open) return;
    const items = query.length >= 2 ? results : history;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        handleSelect(items[selectedIndex]);
      } else if (query.trim().length >= 2) {
        addToHistory(query.trim());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative z-50">
      <button 
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="text-ink-400 hover:text-ink transition-colors p-1.5 rounded-full hover:bg-wire/20 focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-2"
        aria-label="Toggle Search"
        aria-expanded={open}
      >
        <Search size={18} />
      </button>

      {open && (
        <div className="absolute top-12 right-0 w-[90vw] sm:w-[420px] bg-paper border border-wire rounded-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Search Input Area */}
          <div className="flex items-center gap-3 p-3.5 border-b border-wire bg-ink-50/50">
            <Search size={16} className="text-ink-400 shrink-0" />
            <input 
              ref={inputRef} 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown} 
              placeholder="Search stories, news, authors..."
              className="flex-1 text-sm outline-none bg-transparent font-medium text-ink placeholder:text-ink-300 placeholder:font-normal" 
              autoFocus 
              aria-autocomplete="list"
            />
            {query && (
              <button 
                onClick={() => { setQuery(''); inputRef.current?.focus(); }} 
                className="text-ink-400 hover:text-ink-600 bg-wire/30 p-1 rounded-full transition-colors"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="p-6 flex flex-col items-center justify-center gap-2 text-ink-400">
              <Loader2 size={20} className="animate-spin text-signal" />
              <p className="text-xs uppercase tracking-widest font-bold">Searching...</p>
            </div>
          )}

          {/* Results Array */}
          {!loading && query.length >= 2 && results.length > 0 && (
            <div className="max-h-[60vh] overflow-y-auto" role="listbox">
              {results.map((item, i) => (
                <button 
                  key={item.id} 
                  role="option"
                  aria-selected={i === selectedIndex}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-4 border-b border-wire/50 last:border-0 transition-colors ${i === selectedIndex ? 'bg-ink/5' : 'hover:bg-ink-50'}`}
                >
                  {item.cover_image ? (
                    <img src={item.cover_image} alt="" className="w-12 h-12 rounded-sm object-cover shrink-0 shadow-sm border border-wire" />
                  ) : (
                    <div className="w-12 h-12 rounded-sm bg-wire/20 shrink-0 flex items-center justify-center border border-wire">
                      <Search size={16} className="text-ink-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink truncate group-hover:text-signal transition-colors">{item.title}</p>
                    <p className="text-[11px] text-ink-500 capitalize tracking-wide font-medium mt-0.5">
                      {item.type || 'Story'} · {item.author_id === 'u_newsdesk' ? 'Opinion+ News' : 'Community'}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-ink-300 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center">
                <Search size={18} className="text-ink-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">No results found</p>
                <p className="text-xs text-ink-500 mt-1">We couldn&apos;t find anything matching &quot;{query}&quot;</p>
              </div>
            </div>
          )}

          {/* History State */}
          {!loading && query.length < 2 && history.length > 0 && (
            <div className="max-h-[50vh] overflow-y-auto pb-2">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 sticky top-0 bg-paper z-10 border-b border-wire/50">
                <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400 flex items-center gap-1.5">
                  <Clock size={12} /> Recent Searches
                </span>
                <button 
                  onClick={() => { clearHistory(); setHistory([]); }} 
                  className="text-[10px] font-bold uppercase tracking-widest text-ink-400 hover:text-signal transition-colors"
                >
                  Clear All
                </button>
              </div>
              {history.map((item, i) => (
                <button 
                  key={i} 
                  role="option"
                  aria-selected={i === selectedIndex}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${i === selectedIndex ? 'bg-ink/5' : 'hover:bg-ink-50'}`}
                >
                  <Clock size={14} className="text-ink-300" /> 
                  <span className="font-medium text-ink-600 truncate flex-1">{item}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}