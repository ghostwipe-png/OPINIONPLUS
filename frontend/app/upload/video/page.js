'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, Film, CheckCircle, AlertCircle, Loader2, X, ArrowRight,
  Clock, Eye, EyeOff, Globe, Lock, Tag, Monitor, Play, Pause,
} from 'lucide-react';
import { useAuth } from '../../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const DIRECT_UPLOAD_THRESHOLD = 100 * 1024 * 1024; // 100 MB

const CATEGORIES = [
  { value: 'news', label: 'News' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'educational', label: 'Educational' },
  { value: 'music', label: 'Music' },
  { value: 'sports', label: 'Sports' },
  { value: 'technology', label: 'Technology' },
  { value: 'movies', label: 'Movies' },
  { value: 'series', label: 'Series' },
  { value: 'general', label: 'General' },
];

const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Public', icon: Globe, desc: 'Everyone can see this video' },
  { value: 'unlisted', label: 'Unlisted', icon: EyeOff, desc: 'Only people with the link' },
  { value: 'private', label: 'Private', icon: Lock, desc: 'Only you can see this video' },
];

export default function VideoUploadPage() {
  const { user, isAuthenticated, ready } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('news');
  const [privacy, setPrivacy] = useState('public');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [uploadEta, setUploadEta] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [completedVideoId, setCompletedVideoId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [paused, setPaused] = useState(false);
  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);
  const xhrRef = useRef(null);
  const uploadStartRef = useRef(0);
  const lastLoadedRef = useRef(0);
  const speedIntervalRef = useRef(null);
  const tusUploadRef = useRef(null);

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.push('/login');
    }
  }, [ready, isAuthenticated, router]);

  useEffect(() => {
    const footer = document.querySelector('footer');
    const prevDisplay = footer ? footer.style.display : null;
    if (footer) footer.style.display = 'none';
    return () => {
      if (footer) footer.style.display = prevDisplay || '';
    };
  }, []);

  useEffect(() => {
    if (!uploading || paused) {
      if (speedIntervalRef.current) clearInterval(speedIntervalRef.current);
      return;
    }
    speedIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - uploadStartRef.current) / 1000;
      if (elapsed > 1) {
        const speed = (lastLoadedRef.current / elapsed / (1024 * 1024));
        setUploadSpeed(speed);
        if (speed > 0 && file) {
          const remaining = file.size - lastLoadedRef.current;
          const etaSec = remaining / (speed * 1024 * 1024);
          if (etaSec < 60) setUploadEta(`${Math.ceil(etaSec)}s remaining`);
          else if (etaSec < 3600) setUploadEta(`${Math.ceil(etaSec / 60)}m remaining`);
          else setUploadEta(`${Math.ceil(etaSec / 3600)}h remaining`);
        }
      }
    }, 1000);
    return () => clearInterval(speedIntervalRef.current);
  }, [uploading, paused, file]);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024 * 1024) {
      setErrorMsg('File size exceeds 5GB limit.');
      return;
    }

    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska'];
    if (!validTypes.includes(selected.type) && !selected.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
      setErrorMsg('Invalid video format. Please upload MP4, MOV, WEBM, AVI, or MKV files.');
      return;
    }

    setErrorMsg('');
    setFile(selected);
    if (!title) {
      const nameWithoutExt = selected.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }
  };

  const handleThumbnailSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      setErrorMsg('Thumbnail must be under 5MB.');
      return;
    }
    if (!selected.type.startsWith('image/')) {
      setErrorMsg('Thumbnail must be an image file.');
      return;
    }
    setThumbnail(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect({ target: { files: [e.dataTransfer.files[0]] } });
    }
  };

  const pauseUpload = () => {
    if (tusUploadRef.current) {
      tusUploadRef.current.abort();
      tusUploadRef.current = null;
    }
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setPaused(true);
    setUploading(false);
    setStatusMessage('Upload paused');
  };

  const resumeUpload = () => {
    setPaused(false);
    setUploading(true);
    startUploadProcess();
  };

  // ── Direct TUS upload to Bunny (for files > 100 MB) ──
  const uploadDirectToBunny = async (videoId, bunnyVideoId, libraryId, apiKey) => {
    const tusEndpoint = `https://video.bunnycdn.com/tusupload`;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      tusUploadRef.current = xhr;
      
      xhr.open('POST', tusEndpoint, true);
      xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
      xhr.setRequestHeader('LibraryId', String(libraryId));
      xhr.setRequestHeader('VideoId', bunnyVideoId);
      xhr.setRequestHeader('Content-Length', file.size);
      xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
          lastLoadedRef.current = event.loaded;
        }
      };

      xhr.onload = () => {
        tusUploadRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          let errText = 'Direct upload failed';
          try {
            const resJson = JSON.parse(xhr.responseText);
            if (resJson.error) errText = resJson.error;
          } catch (e) {}
          reject(new Error(errText));
        }
      };

      xhr.onerror = () => {
        tusUploadRef.current = null;
        reject(new Error('Network error during direct upload'));
      };

      xhr.send(file);
    });
  };

  // ── Proxied upload through Worker (for files ≤ 100 MB) ──
  const uploadViaWorker = async (videoId, csrfToken) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open('PUT', `${API_BASE}/videos/${videoId}/upload`, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
          lastLoadedRef.current = event.loaded;
        }
      };

      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          let errText = 'Upload failed';
          try {
            const resJson = JSON.parse(xhr.responseText);
            if (resJson.error) errText = resJson.error;
          } catch (e) {}
          reject(new Error(errText));
        }
      };

      xhr.onerror = () => {
        xhrRef.current = null;
        reject(new Error('Network error during video upload'));
      };
      xhr.send(file);
    });
  };

  const startUploadProcess = async () => {
    if (!title.trim() || !file) {
      setErrorMsg('Please provide a title and select a video file.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setProgress(0);
    uploadStartRef.current = Date.now();
    lastLoadedRef.current = 0;

    const isLargeFile = file.size > DIRECT_UPLOAD_THRESHOLD;

    try {
      setStatusMessage('Initializing video entry...');
      const csrfRes = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
      const csrfData = await csrfRes.json().catch(() => ({}));
      const csrfToken = csrfData.token || '';

      const createRes = await fetch(`${API_BASE}/videos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        body: JSON.stringify({
          title,
          description,
          category,
          privacy,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to initialize video upload');

      const videoId = createData.video.id;
      const bunnyVideoId = createData.video.bunny_video_id;

      if (isLargeFile) {
        // Direct upload to Bunny for large files
        setStatusMessage(`Uploading directly (large file: ${(file.size / (1024 * 1024)).toFixed(0)} MB)...`);
        
        // Fetch Bunny API key from backend
        const bunnyKeyRes = await fetch(`${API_BASE}/videos/upload-key`, {
          credentials: 'include',
          headers: { 'X-CSRF-Token': csrfToken },
        });
        const bunnyKeyData = await bunnyKeyRes.json().catch(() => ({}));
        const bunnyApiKey = bunnyKeyData.apiKey || '';

        if (!bunnyApiKey) throw new Error('Could not get upload credentials');

        await uploadDirectToBunny(videoId, bunnyVideoId, bunnyKeyData.libraryId || '713291', bunnyApiKey);
      } else {
        // Proxied upload through Worker for smaller files
        setStatusMessage(`Uploading video (${(file.size / (1024 * 1024)).toFixed(0)} MB)...`);
        await uploadViaWorker(videoId, csrfToken);
      }

      setStatusMessage('Finalizing upload...');
      await fetch(`${API_BASE}/videos/${videoId}/upload-complete`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
      });

      setStatusMessage('Processing & encoding video...');
      let isReady = false;
      let attempts = 0;
      while (!isReady && attempts < 60) {
        attempts++;
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(`${API_BASE}/videos/${videoId}/status`, { credentials: 'include' });
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.status === 'ready') {
          isReady = true;
        } else if (statusData.status === 'failed') {
          throw new Error('Video encoding failed on server.');
        }
        if (statusData.progress) setProgress(statusData.progress);
      }

      setProgress(100);
      setCompletedVideoId(videoId);
      setUploading(false);
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || 'Upload process failed');
      setUploading(false);
    }
  };

  const startUpload = (e) => {
    e.preventDefault();
    startUploadProcess();
  };

  if (!ready || !isAuthenticated) return null;

  if (completedVideoId) {
    return (
      <div className="bg-paper min-h-screen py-24 px-5 flex items-center justify-center">
        <div className="bg-white border-2 border-ink p-8 sm:p-12 max-w-md w-full text-center space-y-6 shadow-2xl rounded-sm">
          <div className="w-16 h-16 bg-emerald-100 border border-emerald-300 text-emerald-600 rounded-full grid place-items-center mx-auto">
            <CheckCircle size={32} className="animate-bounce" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-ink uppercase tracking-wider">Ready to Broadcast!</h2>
            <p className="text-xs font-bold text-emerald-700 uppercase">Your video is successfully encoded and live.</p>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Link
              href={`/videos/${completedVideoId}`}
              className="flex-1 bg-ink text-white font-bold uppercase text-xs tracking-wider py-3.5 rounded-sm hover:bg-signal transition-colors text-center flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Monitor size={14} /> Watch Video
            </Link>
            <Link
              href="/videos"
              className="flex-1 border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider py-3.5 rounded-sm hover:border-ink transition-colors text-center"
            >
              Video Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isLargeFile = file && file.size > DIRECT_UPLOAD_THRESHOLD;

  return (
    <div className="bg-paper min-h-screen py-12 pb-24">
      <div className="max-w-3xl mx-auto px-5">
        <div className="mb-8 border-b-2 border-wire/60 pb-6">
          <div className="bg-ink text-white font-bold uppercase text-xs px-3 py-1.5 inline-block rounded-sm mb-3">
            Creator Studio
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-ink tracking-tight">
            Upload Video Broadcast
          </h1>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-sm flex items-center gap-2">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        <form onSubmit={startUpload} className="space-y-6">
          {/* File Drop Zone */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">
              Video File (Max 5GB{isLargeFile ? ' — Direct upload' : ''})
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-sm p-10 text-center transition-colors group ${
                file ? 'border-ink bg-ink-50/50' : 'border-wire bg-white hover:border-ink cursor-pointer'
              }`}
            >
              {file ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between bg-white p-4 border border-wire rounded-sm">
                    <div className="flex items-center gap-3 text-left">
                      <Film className="text-signal shrink-0" size={24} />
                      <div>
                        <p className="text-xs font-bold text-ink truncate max-w-xs">{file.name}</p>
                        <p className="text-[10px] text-ink-400 font-mono">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                          {isLargeFile && <span className="text-signal font-bold ml-1">· Direct Bunny upload</span>}
                        </p>
                      </div>
                    </div>
                    {!uploading && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="text-ink-400 hover:text-signal p-1"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="text-xs text-ink-500 hover:text-ink underline font-medium"
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-ink-50 rounded-full grid place-content-center group-hover:bg-ink group-hover:text-white transition-colors">
                    <Upload size={24} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink">Click to browse or drag & drop video</span>
                  <span className="text-[11px] text-ink-400">MP4, MOV, WEBM, AVI, MKV supported · Files over 100MB upload directly to Bunny</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,.mp4,.mov,.webm,.avi,.mkv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter video title..."
              className="w-full text-base font-bold text-ink bg-white border border-wire rounded-sm p-3.5 focus:outline-none focus:border-ink"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, summaries, or credits..."
              rows={4}
              className="w-full text-xs font-medium text-ink bg-white border border-wire rounded-sm p-3.5 focus:outline-none focus:border-ink resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block flex items-center gap-1.5">
              <Tag size={12} /> Tags
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="kenya, politics, documentary (comma separated)"
              className="w-full text-xs font-medium text-ink bg-white border border-wire rounded-sm p-3 focus:outline-none focus:border-ink"
            />
            <p className="text-[10px] text-ink-400">Separate tags with commas. Helps viewers discover your content.</p>
          </div>

          {/* Category & Privacy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-wire rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-wider bg-white focus:outline-none focus:border-ink"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Visibility</label>
              <div className="space-y-1.5">
                {PRIVACY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <label
                      key={opt.value}
                      onClick={() => setPrivacy(opt.value)}
                      className={`flex items-center gap-3 border rounded-sm px-4 py-3 cursor-pointer transition-colors ${
                        privacy === opt.value ? 'border-ink bg-ink-50' : 'border-wire hover:border-ink-300'
                      }`}
                    >
                      <Icon size={16} className={privacy === opt.value ? 'text-ink' : 'text-ink-400'} />
                      <div>
                        <p className="text-xs font-bold text-ink">{opt.label}</p>
                        <p className="text-[10px] text-ink-400">{opt.desc}</p>
                      </div>
                      <div className={`ml-auto w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        privacy === opt.value ? 'border-ink' : 'border-wire'
                      }`}>
                        {privacy === opt.value && <div className="w-2 h-2 rounded-full bg-ink" />}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Thumbnail */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Custom Thumbnail (Optional)</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => thumbInputRef.current?.click()}
                className="border border-dashed border-wire rounded-sm px-4 py-3 text-xs font-bold text-ink-500 hover:border-ink hover:text-ink transition-colors flex items-center gap-2"
              >
                <Upload size={14} />
                {thumbnail ? thumbnail.name : 'Upload thumbnail image'}
              </button>
              {thumbnail && (
                <button type="button" onClick={() => setThumbnail(null)} className="text-ink-400 hover:text-signal p-1">
                  <X size={16} />
                </button>
              )}
              <input ref={thumbInputRef} type="file" accept="image/*" onChange={handleThumbnailSelect} className="hidden" />
            </div>
            <p className="text-[10px] text-ink-400">JPEG or PNG, max 5MB. Auto-generated if not provided.</p>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="bg-white border border-wire p-6 rounded-sm space-y-4">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-ink flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-signal" /> {statusMessage}
                </span>
                <span className="text-signal">{progress}%</span>
              </div>
              <div className="w-full bg-wire/30 h-2.5 rounded-full overflow-hidden">
                <div className="bg-signal h-full transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] text-ink-400 font-medium">
                <span>{uploadSpeed > 0 ? `${uploadSpeed.toFixed(1)} MB/s` : 'Starting...'}</span>
                <span className="flex items-center gap-1"><Clock size={10} /> {uploadEta || 'Calculating...'}</span>
              </div>
              <button type="button" onClick={pauseUpload} className="flex items-center gap-1.5 text-xs font-bold text-ink-500 hover:text-signal transition-colors">
                <Pause size={14} /> Pause Upload
              </button>
            </div>
          )}

          {paused && !uploading && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-sm space-y-3">
              <div className="flex items-center gap-2 text-amber-700">
                <Pause size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Upload paused — {progress}% complete</span>
              </div>
              <button type="button" onClick={resumeUpload} className="flex items-center gap-1.5 bg-ink text-white text-xs font-bold uppercase px-4 py-2 rounded-sm hover:bg-signal transition-colors">
                <Play size={14} /> Resume Upload
              </button>
            </div>
          )}

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="w-full bg-signal text-white font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <><Loader2 size={16} className="animate-spin" /> Processing Broadcast...</>
              ) : paused ? (
                <><Play size={16} /> Resume Upload</>
              ) : (
                <><Upload size={16} /> Upload Video</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}