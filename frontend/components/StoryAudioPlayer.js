'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Volume2, Loader2 } from 'lucide-react';

export default function StoryAudioPlayer({ title, body }) {
  const [supported, setSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!supported) return null;

  // Strip HTML tags to get clean plain text for narration
  const getPlainText = (html) => {
    if (!html) return '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const handlePlay = () => {
    if (!window.speechSynthesis) return;

    // If currently paused, resume speaking
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // If already playing, do nothing
    if (isPlaying) return;

    setLoading(true);
    window.speechSynthesis.cancel(); // Stop any previous speech

    const plainText = `${title}. ${getPlainText(body)}`;
    const utterance = new SpeechSynthesisUtterance(plainText);
    
    utterance.rate = 1.0; // Normal speed
    utterance.pitch = 1.0; // Normal pitch

    utterance.onstart = () => {
      setLoading(false);
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setLoading(false);
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePause = () => {
    if (window.speechSynthesis && isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      setLoading(false);
    }
  };

  return (
    <div className="bg-ink text-white p-4 rounded-md shadow-lg border border-signal/40 flex flex-col sm:flex-row items-center justify-between gap-4 my-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-sm bg-signal/20 text-signal flex items-center justify-center shrink-0 border border-signal/30">
          <Volume2 size={20} />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-white">Listen to Article</p>
          <p className="text-[11px] text-white/60 font-medium">
            {loading ? 'Preparing audio engine...' : isPlaying ? 'Playing narration...' : isPaused ? 'Narration paused' : 'AI & Native Speech Reader'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-sm text-xs font-bold uppercase tracking-widest">
            <Loader2 size={14} className="animate-spin text-signal" /> Loading
          </div>
        ) : !isPlaying && !isPaused ? (
          <button 
            onClick={handlePlay}
            className="flex-1 sm:flex-none bg-signal text-white font-black uppercase text-xs tracking-widest px-5 py-2.5 rounded-sm hover:bg-white hover:text-signal transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <Play size={14} fill="currentColor" /> Listen
          </button>
        ) : (
          <>
            {isPlaying && (
              <button 
                onClick={handlePause}
                className="bg-white/10 text-white font-bold uppercase text-xs tracking-widest px-4 py-2.5 rounded-sm hover:bg-white/20 transition-colors flex items-center gap-1.5"
              >
                <Pause size={14} /> Pause
              </button>
            )}
            {isPaused && (
              <button 
                onClick={handlePlay}
                className="bg-signal text-white font-bold uppercase text-xs tracking-widest px-4 py-2.5 rounded-sm hover:bg-white hover:text-signal transition-colors flex items-center gap-1.5"
              >
                <Play size={14} fill="currentColor" /> Resume
              </button>
            )}
            <button 
              onClick={handleStop}
              className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500 hover:text-white transition-colors p-2.5 rounded-sm"
              title="Stop narration"
            >
              <Square size={14} fill="currentColor" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}