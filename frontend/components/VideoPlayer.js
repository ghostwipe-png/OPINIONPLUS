'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipBack, SkipForward, PictureInPicture2, Loader2
} from 'lucide-react';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP_SECONDS = 10;
const AUTO_HIDE_DELAY = 4000;

function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayer({ bunnyLibraryId, bunnyVideoId, title, onTimeUpdate, onEnded }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const hideTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [pip, setPip] = useState(false);

  const cdnHostname = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || 'iframe.mediadelivery.net';
  const hlsUrl = `https://${cdnHostname}/${bunnyLibraryId}/${bunnyVideoId}/playlist.m3u8`;

  // ── Core Playback ──────────────────────────────────

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
    showControlsTemporarily();
  }, []);

  const handleSeek = useCallback((e) => {
    const video = videoRef.current;
    const progressBar = progressRef.current;
    if (!video || !progressBar) return;
    const rect = progressBar.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = fraction * video.duration;
    setCurrentTime(video.currentTime);
  }, []);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - SKIP_SECONDS);
    showControlsTemporarily();
  }, []);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration, video.currentTime + SKIP_SECONDS);
    showControlsTemporarily();
  }, []);

  // ── Volume ─────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showControlsTemporarily();
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const video = videoRef.current;
    if (!video) return;
    const newVol = parseFloat(e.target.value);
    video.volume = newVol;
    setVolume(newVol);
    setMuted(newVol === 0);
  }, []);

  // ── Speed ──────────────────────────────────────────

  const changeSpeed = useCallback((newSpeed) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = newSpeed;
    setSpeed(newSpeed);
    setShowSpeedMenu(false);
  }, []);

  // ── Fullscreen ─────────────────────────────────────

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
    showControlsTemporarily();
  }, []);

  // ── Picture-in-Picture ─────────────────────────────

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setPip(false);
      } else {
        await video.requestPictureInPicture();
        setPip(true);
      }
    } catch {
      // PiP not supported or denied
    }
  }, []);

  // ── Controls Auto-Hide ─────────────────────────────

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (playing) {
      hideTimerRef.current = setTimeout(() => setControlsVisible(false), AUTO_HIDE_DELAY);
    }
  }, [playing]);

  // ── Event Handlers ─────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setLoading(false);
    };

    const onTimeUpdateHandler = () => {
      if (!seeking) {
        setCurrentTime(video.currentTime);
      }
      if (onTimeUpdate) onTimeUpdate(video.currentTime, video.duration);
    };

    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onEndedHandler = () => {
      setPlaying(false);
      if (onEnded) onEnded();
    };
    const onFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    const onPipChange = () => {
      setPip(!!document.pictureInPictureElement);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('timeupdate', onTimeUpdateHandler);
    video.addEventListener('progress', onProgress);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('ended', onEndedHandler);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    video.addEventListener('enterpictureinpicture', onPipChange);
    video.addEventListener('leavepictureinpicture', onPipChange);

    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('timeupdate', onTimeUpdateHandler);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('ended', onEndedHandler);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      video.removeEventListener('enterpictureinpicture', onPipChange);
      video.removeEventListener('leavepictureinpicture', onPipChange);
    };
  }, [seeking, onTimeUpdate, onEnded]);

  // ── Keyboard Shortcuts ─────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'j':
          e.preventDefault();
          skipBackward();
          break;
        case 'l':
          e.preventDefault();
          skipForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (videoRef.current) {
            const newVol = Math.min(1, videoRef.current.volume + 0.1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
            setMuted(false);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) {
            const newVol = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = newVol;
            setVolume(newVol);
            setMuted(newVol === 0);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, toggleFullscreen, toggleMute, skipBackward, skipForward]);

  // ── Cleanup ────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full aspect-video group overflow-hidden"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => { if (playing) setControlsVisible(false); }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full"
        src={hlsUrl}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        crossOrigin="anonymous"
      />

      {/* Loading Spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <Loader2 size={48} className="animate-spin text-white/80" />
        </div>
      )}

      {/* Big Play Button (when paused) */}
      {!playing && !loading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
          aria-label="Play"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
            <Play size={32} fill="white" className="text-white ml-1" />
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

        {/* Progress Bar */}
        <div
          ref={progressRef}
          className="relative w-full h-1.5 bg-white/30 cursor-pointer group/progress hover:h-2.5 transition-all"
          onClick={handleSeek}
        >
          {/* Buffered */}
          <div
            className="absolute top-0 left-0 h-full bg-white/40"
            style={{ width: `${bufferedPercent}%` }}
          />
          {/* Played */}
          <div
            className="absolute top-0 left-0 h-full bg-signal"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-signal rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-md"
            style={{ left: `calc(${progressPercent}% - 7px)` }}
          />
        </div>

        {/* Controls Bar */}
        <div className="relative flex items-center justify-between px-4 py-2 gap-3">
          {/* Left */}
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white hover:text-signal transition-colors p-1" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button onClick={skipBackward} className="text-white hover:text-signal transition-colors p-1" aria-label="Back 10 seconds">
              <SkipBack size={18} />
            </button>
            <button onClick={skipForward} className="text-white hover:text-signal transition-colors p-1" aria-label="Forward 10 seconds">
              <SkipForward size={18} />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 group/vol">
              <button onClick={toggleMute} className="text-white hover:text-signal transition-colors p-1" aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-signal h-1 cursor-pointer"
                aria-label="Volume"
              />
            </div>

            {/* Time */}
            <span className="text-white text-xs font-mono whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1">
            {/* Speed */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="text-white hover:text-signal transition-colors p-1 text-xs font-bold"
                aria-label="Playback speed"
              >
                {speed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm border border-white/10 rounded-sm overflow-hidden shadow-xl">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={`block w-full text-left px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                        s === speed ? 'text-signal bg-white/10' : 'text-white hover:bg-white/10'
                      }`}
                    >
                      {s === 1 ? 'Normal' : `${s}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PiP */}
            <button
              onClick={togglePip}
              className="text-white hover:text-signal transition-colors p-1"
              aria-label="Picture in Picture"
            >
              <PictureInPicture2 size={18} />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-signal transition-colors p-1"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}