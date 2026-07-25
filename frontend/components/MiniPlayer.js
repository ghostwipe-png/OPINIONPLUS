'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Expand } from 'lucide-react';
import Link from 'next/link';

export default function MiniPlayer({ videoId, title, bunnyLibraryId, bunnyVideoId, isVisible }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState({ x: null, y: null });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 220 });
  const [closed, setClosed] = useState(false);

  const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || 'iframe.mediadelivery.net';
  const hlsUrl = `https://${cdnHostname}/${bunnyLibraryId}/${bunnyVideoId}/playlist.m3u8`;

  // Reset closed state when video changes
  useEffect(() => {
    setClosed(false);
    setPlaying(false);
  }, [videoId]);

  // Sync playback with main player (basic — just start playing)
  useEffect(() => {
    if (isVisible && !closed && videoRef.current) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
  }, [isVisible, closed]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  };

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setPlaying(false);
    setClosed(true);
  };

  // Dragging
  const handleMouseDown = (e) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e) => {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 340, e.clientX - dragStart.x)),
        y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragStart.y)),
      });
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragStart, pos]);

  if (!isVisible || closed) return null;

  return (
    <div
      className="fixed z-[100] shadow-2xl rounded-lg overflow-hidden border border-wire bg-black"
      style={{
        width: '320px',
        bottom: `${window.innerHeight - pos.y - 180}px`,
        right: `${window.innerWidth - pos.x - 320}px`,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Drag handle + controls */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 left-0 right-0 h-8 z-10 flex items-center justify-between px-2 bg-gradient-to-b from-black/80 to-transparent"
      >
        <span className="text-white text-[10px] font-medium truncate max-w-[70%]">
          {title || 'Playing'}
        </span>
        <div className="flex items-center gap-1">
          <Link
            href={`/videos/${videoId}`}
            className="text-white/80 hover:text-white p-0.5"
            title="Expand"
          >
            <Expand size={14} />
          </Link>
          <button
            onClick={handleClose}
            className="text-white/80 hover:text-white p-0.5"
            title="Close miniplayer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        src={hlsUrl}
        className="w-full aspect-video object-cover"
        playsInline
        muted={false}
        onClick={togglePlay}
        crossOrigin="anonymous"
      />

      {/* Play/Pause overlay */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play size={20} fill="white" className="text-white ml-0.5" />
          </div>
        </button>
      )}
    </div>
  );
}