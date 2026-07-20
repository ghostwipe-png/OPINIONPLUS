'use client';

import { useState, useEffect } from 'react';
import { Volume2, Square, Play, Loader2 } from 'lucide-react';

export default function AudioPlayer({ title, bodyHtml }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isSupported) return null;

  const toggleSpeech = () => {
    const synth = window.speechSynthesis;

    if (isPlaying) {
      synth.cancel();
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    // Strip HTML tags for clean audio speech
    const cleanText = (bodyHtml || '').replace(/<[^>]*>/g, ' ');
    const textToSpeech = `Article: ${title}. ${cleanText}`;

    const utterance = new SpeechSynthesisUtterance(textToSpeech);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsLoading(false);
      setIsPlaying(true);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    synth.speak(utterance);
  };

  return (
    <div className="bg-ink-50 border border-wire rounded-sm p-4 my-6 flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-ink text-white rounded-sm grid place-items-center">
          <Volume2 size={18} className="text-signal" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink">Listen to this story</p>
          <p className="text-[11px] text-ink-500 font-medium">AI Audio Narration · Estimated listening duration</p>
        </div>
      </div>

      <button 
        onClick={toggleSpeech}
        disabled={isLoading}
        className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 size={14} className="animate-spin text-signal" /> Loading Voice...
          </>
        ) : isPlaying ? (
          <>
            <Square size={14} className="text-signal" fill="currentColor" /> Stop Audio
          </>
        ) : (
          <>
            <Play size={14} className="text-signal" fill="currentColor" /> Listen Now
          </>
        )}
      </button>
    </div>
  );
}