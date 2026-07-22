'use client';

import { useEffect, useRef } from 'react';

const EMOJIS = ['🎉', '👏', '❤️', '🔥', '😂', '😮', '👍', '💡'];

export default function ReactionPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={ref}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-[#1a1a2e] border border-white/10 rounded-xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.8)] grid grid-cols-4 gap-1 animate-in zoom-in-95 duration-150 origin-bottom"
    >
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl hover:bg-white/10 transition-colors transform hover:scale-125 duration-200"
        >
          {emoji}
        </button>
      ))}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-transparent border-t-[#1a1a2e]" />
    </div>
  );
}