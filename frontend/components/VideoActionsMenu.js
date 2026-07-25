'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreVertical, ListPlus, Clock, Flag, Share2, Copy, Check } from 'lucide-react';

export default function VideoActionsMenu({
  videoId,
  onSaveToPlaylist,
  onWatchLater,
  onReport,
  inWatchLater,
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleCopyLink = () => {
    const url = `${window.location.origin}/videos/${videoId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setOpen(false);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (action) => {
    action();
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-full text-ink-400 hover:text-ink hover:bg-ink-50 transition-colors"
        aria-label="More actions"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-48 bg-white border border-wire rounded-sm shadow-xl z-50 py-1 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Add to Playlist */}
          {onSaveToPlaylist && (
            <button
              onClick={() => handleAction(onSaveToPlaylist)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
            >
              <ListPlus size={16} className="text-ink-400" />
              Save to playlist
            </button>
          )}

          {/* Watch Later */}
          {onWatchLater && (
            <button
              onClick={() => handleAction(onWatchLater)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
            >
              <Clock size={16} className="text-ink-400" />
              {inWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}
            </button>
          )}

          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
          >
            {copied ? (
              <>
                <Check size={16} className="text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy size={16} className="text-ink-400" />
                Copy link
              </>
            )}
          </button>

          {/* Report */}
          {onReport && (
            <>
              <div className="border-t border-wire my-1" />
              <button
                onClick={() => handleAction(onReport)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-ink-600 hover:bg-ink-50 transition-colors"
              >
                <Flag size={16} className="text-ink-400" />
                Report
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}