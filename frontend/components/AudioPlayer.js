// components/AudioPlayer.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Play, Pause, SkipBack, SkipForward, Loader2, Gauge, Download } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AudioPlayer({ storyId, title, bodyHtml }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for Web Speech API as fallback
      const hasSpeechSynthesis = 'speechSynthesis' in window;
      setIsSupported(hasSpeechSynthesis);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Check for cached audio on mount
  useEffect(() => {
    if (!storyId) return;
    const cached = sessionStorage.getItem(`audio_${storyId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setAudioUrl(parsed.url);
        setDuration(parsed.duration || 0);
      } catch (e) {}
    }
  }, [storyId]);

  const fetchAudio = useCallback(async () => {
    if (audioUrl) return; // Already loaded
    if (!storyId) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/ai-services/audio/${storyId}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok && data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setDuration(data.duration || 0);
        try {
          sessionStorage.setItem(`audio_${storyId}`, JSON.stringify({
            url: data.audioUrl,
            duration: data.duration,
          }));
        } catch (e) {}
      } else {
        // Fallback to Web Speech API
        setError(data.error || 'TTS not available. Using browser speech.');
      }
    } catch (e) {
      setError('Audio generation failed. Using browser speech.');
    }

    setIsLoading(false);
  }, [storyId, audioUrl]);

  const togglePlay = async () => {
    if (!audioUrl) {
      await fetchAudio();
      return;
    }

    if (isPlaying) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(() => setError('Playback failed.'));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    if (audioRef.current) {
      audioRef.current.currentTime = percent * (duration || audioRef.current.duration || 0);
    }
  };

  const changeSpeed = () => {
    const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const currentIdx = rates.indexOf(playbackRate);
    const nextIdx = (currentIdx + 1) % rates.length;
    const newRate = rates[nextIdx];
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  const skipBack = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        duration || audioRef.current.duration || 0,
        audioRef.current.currentTime + 30
      );
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isSupported) return null;

  return (
    <div className="bg-ink-50 border border-wire rounded-sm overflow-hidden shadow-sm my-6">
      {/* Hidden audio element for cloud TTS */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => setError('Audio playback failed.')}
      />

      {/* Player Bar */}
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Icon + Info */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-sm grid place-items-center shrink-0 ${isPlaying ? 'bg-signal' : 'bg-ink'}`}>
              <Volume2 size={18} className={isPlaying ? 'text-white' : 'text-signal'} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-ink truncate">
                {isPlaying ? 'Now Playing' : 'Listen to this story'}
              </p>
              <p className="text-[11px] text-ink-500 font-medium truncate">
                {isPlaying 
                  ? `${formatTime(currentTime)} / ${formatTime(duration || audioRef.current?.duration)}`
                  : 'AI Audio Narration'}
              </p>
            </div>
          </div>

          {/* Center: Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={skipBack}
              className="p-2 rounded-sm text-ink-400 hover:text-ink hover:bg-ink-100 transition-colors"
              title="Back 10s"
            >
              <SkipBack size={16} />
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading}
              className="w-10 h-10 bg-ink text-white rounded-full grid place-items-center hover:bg-signal transition-colors disabled:opacity-50 shadow-sm"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : isPlaying ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" className="ml-0.5" />
              )}
            </button>

            <button
              onClick={skipForward}
              className="p-2 rounded-sm text-ink-400 hover:text-ink hover:bg-ink-100 transition-colors"
              title="Forward 30s"
            >
              <SkipForward size={16} />
            </button>
          </div>

          {/* Right: Speed + Info */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={changeSpeed}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-400 hover:text-ink transition-colors border border-wire rounded-sm px-2 py-1.5 hover:border-ink"
              title="Change speed"
            >
              <Gauge size={12} />
              {playbackRate}x
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div
          className="mt-3 h-1.5 bg-wire/40 rounded-sm cursor-pointer group"
          onClick={handleSeek}
        >
          <div
            className="h-full bg-signal rounded-sm transition-all duration-100 group-hover:bg-signal/80"
            style={{
              width: `${duration || audioRef.current?.duration
                ? ((currentTime / (duration || audioRef.current?.duration || 1)) * 100)
                : 0}%`
            }}
          />
        </div>
      </div>

      {error && (
        <div className="px-4 pb-3">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{error}</p>
        </div>
      )}
    </div>
  );
}