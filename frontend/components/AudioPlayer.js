// components/AudioPlayer.js
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Play, Pause, SkipBack, SkipForward, Loader2, Gauge } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AudioPlayer({ storyId, title, bodyHtml }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [useCloudTTS, setUseCloudTTS] = useState(true); // Try cloud first, fall back to browser
  const audioRef = useRef(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSpeechSynthesis = 'speechSynthesis' in window;
      setIsSupported(hasSpeechSynthesis);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

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
    if (audioUrl) return;
    if (!storyId) return;

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/ai-services/audio/${storyId}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok && data.audioUrl && data.audioUrl.startsWith('data:audio')) {
        setAudioUrl(data.audioUrl);
        setDuration(data.duration || 0);
        try {
          sessionStorage.setItem(`audio_${storyId}`, JSON.stringify({
            url: data.audioUrl,
            duration: data.duration,
          }));
        } catch (e) {}
        setIsLoading(false);
        return;
      }
    } catch (e) {
      // Cloud TTS unavailable — fall through to browser speech
    }

    // Cloud TTS failed or unavailable — use browser speech silently
    setUseCloudTTS(false);
    setIsLoading(false);
  }, [storyId, audioUrl]);

  const playWithBrowserSpeech = () => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const cleanText = (bodyHtml || '').replace(/<[^>]*>/g, ' ');
    const textToSpeech = `${title}. ${cleanText}`;

    const utterance = new SpeechSynthesisUtterance(textToSpeech);
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const togglePlay = async () => {
    if (useCloudTTS && !audioUrl) {
      await fetchAudio();
      // If cloud TTS loaded, play via audio element
      if (audioUrl && audioRef.current) {
        audioRef.current.play().catch(() => setUseCloudTTS(false));
        return;
      }
      // If cloud failed, use browser speech
      if (!useCloudTTS) {
        playWithBrowserSpeech();
        return;
      }
    }

    if (useCloudTTS && audioUrl) {
      if (isPlaying) {
        audioRef.current?.pause();
      } else {
        audioRef.current?.play().catch(() => {
          setUseCloudTTS(false);
          playWithBrowserSpeech();
        });
      }
      return;
    }

    // Browser speech mode
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      playWithBrowserSpeech();
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
    if (!useCloudTTS || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    audioRef.current.currentTime = percent * (duration || audioRef.current.duration || 0);
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
    if (utteranceRef.current) {
      utteranceRef.current.rate = newRate;
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
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />

      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-sm grid place-items-center shrink-0 ${isPlaying ? 'bg-signal' : 'bg-ink'}`}>
              <Volume2 size={18} className={isPlaying ? 'text-white' : 'text-signal'} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-ink truncate">
                {isPlaying ? 'Now Playing' : 'Listen to this story'}
              </p>
              <p className="text-[11px] text-ink-500 font-medium truncate">
                {isPlaying && useCloudTTS && audioUrl
                  ? `${formatTime(currentTime)} / ${formatTime(duration || audioRef.current?.duration)}`
                  : isPlaying && !useCloudTTS
                  ? 'Browser Speech'
                  : 'Audio Narration'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {useCloudTTS && audioUrl && (
              <button
                onClick={skipBack}
                className="p-2 rounded-sm text-ink-400 hover:text-ink hover:bg-ink-100 transition-colors"
                title="Back 10s"
              >
                <SkipBack size={16} />
              </button>
            )}

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

            {useCloudTTS && audioUrl && (
              <button
                onClick={skipForward}
                className="p-2 rounded-sm text-ink-400 hover:text-ink hover:bg-ink-100 transition-colors"
                title="Forward 30s"
              >
                <SkipForward size={16} />
              </button>
            )}
          </div>

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

        {useCloudTTS && audioUrl && (
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
        )}
      </div>
    </div>
  );
}