'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, Film, CheckCircle, AlertCircle, Loader2, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function VideoUploadPage() {
  const { user, isAuthenticated, ready } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('news');
  const [privacy, setPrivacy] = useState('public');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [completedVideoId, setCompletedVideoId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (ready && !isAuthenticated) {
      router.push('/login');
    }
  }, [ready, isAuthenticated, router]);

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 2 * 1024 * 1024 * 1024) {
      setErrorMsg('File size exceeds 2GB limit.');
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

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelect({ target: { files: [droppedFile] } });
    }
  };

  const startUpload = async (e) => {
    e.preventDefault();
    if (!title.trim() || !file) {
      setErrorMsg('Please provide a title and select a video file.');
      return;
    }

    setUploading(true);
    setErrorMsg('');
    setProgress(0);

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
        body: JSON.stringify({ title, description, category, privacy }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to initialize video upload');

      const videoId = createData.video.id;

      setStatusMessage('Uploading video through secure stream...');
      
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', `${API_BASE}/videos/${videoId}/upload`, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        if (csrfToken) xhr.setRequestHeader('X-CSRF-Token', csrfToken);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setProgress(percent);
          }
        };

        xhr.onload = async () => {
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

        xhr.onerror = () => reject(new Error('Network error during video upload'));
        xhr.send(file);
      });

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
      while (!isReady && attempts < 30) {
        attempts++;
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(`${API_BASE}/videos/${videoId}/status`, { credentials: 'include' });
        const statusData = await statusRes.json().catch(() => ({}));
        if (statusData.status === 'ready') {
          isReady = true;
        } else if (statusData.status === 'failed') {
          throw new Error('Video encoding failed on server.');
        }
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
              Watch Video <ArrowRight size={14} />
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
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Video File (Max 2GB)</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-wire bg-white hover:border-ink rounded-sm p-10 text-center cursor-pointer transition-colors group"
            >
              {file ? (
                <div className="flex items-center justify-between bg-ink-50 p-4 border border-wire rounded-sm">
                  <div className="flex items-center gap-3 text-left">
                    <Film className="text-signal shrink-0" size={24} />
                    <div>
                      <p className="text-xs font-bold text-ink truncate max-w-xs">{file.name}</p>
                      <p className="text-[10px] text-ink-400 font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-ink-400 hover:text-signal p-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-ink-50 rounded-full grid place-content-center group-hover:bg-ink group-hover:text-white transition-colors">
                    <Upload size={22} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-ink">Click to browse or drag & drop video</span>
                  <span className="text-[11px] text-ink-400">MP4, MOV, WEBM, AVI, MKV supported</span>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-wire rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-wider bg-white focus:outline-none focus:border-ink"
              >
                <option value="news">News</option>
                <option value="documentary">Documentary</option>
                <option value="entertainment">Entertainment</option>
                <option value="educational">Educational</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-400 block">Privacy</label>
              <select
                value={privacy}
                onChange={(e) => setPrivacy(e.target.value)}
                className="w-full border border-wire rounded-sm px-4 py-3 text-xs font-bold uppercase tracking-wider bg-white focus:outline-none focus:border-ink"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          {uploading && (
            <div className="bg-white border border-wire p-6 rounded-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                <span className="text-ink flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-signal" /> {statusMessage}
                </span>
                <span className="text-signal">{progress}%</span>
              </div>
              <div className="w-full bg-wire/30 h-2 rounded-full overflow-hidden">
                <div className="bg-signal h-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              type="submit"
              disabled={uploading || !file || !title.trim()}
              className="w-full bg-signal text-white font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Processing Broadcast...' : 'Upload Video'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}