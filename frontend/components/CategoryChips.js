'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'news', label: 'News' },
  { key: 'documentary', label: 'Documentaries' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'educational', label: 'Educational' },
  { key: 'music', label: 'Music' },
  { key: 'sports', label: 'Sports' },
  { key: 'technology', label: 'Technology' },
];

export default function CategoryChips({ activeCategory, onSelect }) {
  const scrollRef = useRef(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftArrow(el.scrollLeft > 5);
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    checkArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkArrows, { passive: true });
    window.addEventListener('resize', checkArrows);
    return () => {
      el.removeEventListener('scroll', checkArrows);
      window.removeEventListener('resize', checkArrows);
    };
  }, []);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  return (
    <div className="relative flex items-center">
      {/* Left Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 bg-paper/90 backdrop-blur-sm border border-wire rounded-full p-1.5 shadow-sm hover:bg-ink-50 transition-colors"
          aria-label="Scroll left"
        >
          <ChevronLeft size={16} className="text-ink-500" />
        </button>
      )}

      {/* Chips */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-none scroll-smooth py-2 px-1"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => onSelect(cat.key)}
            className={`px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all border ${
              activeCategory === cat.key
                ? 'bg-ink text-white border-ink shadow-sm'
                : 'bg-white text-ink-600 border-wire hover:border-ink hover:bg-ink-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 bg-paper/90 backdrop-blur-sm border border-wire rounded-full p-1.5 shadow-sm hover:bg-ink-50 transition-colors"
          aria-label="Scroll right"
        >
          <ChevronRight size={16} className="text-ink-500" />
        </button>
      )}
    </div>
  );
}