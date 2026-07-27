// components/PressKitUploader.js
'use client';

import { useState, useRef, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, FileText, File as FileIcon, X, Loader2, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;
const FILE_TYPES = ['image', 'logo', 'pdf', 'document'];

async function getCsrfToken() {
  try {
    const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
    const data = await res.json();
    return data.token || '';
  } catch (e) {
    return '';
  }
}

function iconFor(fileType) {
  if (fileType === 'pdf') return FileText;
  if (fileType === 'image' || fileType === 'logo') return ImageIcon;
  return FileIcon;
}

function guessFileType(file) {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  return 'document';
}

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// NOTE: This component expects a `file_url` to already be reachable (e.g. from your
// object storage / CDN upload step). It registers that URL against the press release's
// kit via POST /services/press-release/:id/kit. Swap `uploadFileAndGetUrl` for your
// actual upload flow (e.g. the existing /uploads route) if files aren't hosted yet.
async function uploadFileAndGetUrl(file) {
  const formData = new FormData();
  formData.append('file', file);
  const csrfToken = await getCsrfToken();
  const res = await fetch(`${API_BASE}/uploads`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': csrfToken },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || !data.url) throw new Error(data.error || 'File upload failed.');
  return data.url;
}

export default function PressKitUploader({ releaseId, initialFiles = [], onFileAdded, onFileRemoved }) {
  const [files, setFiles] = useState(initialFiles);
  const [uploadingNames, setUploadingNames] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const addFile = useCallback(async (browserFile) => {
    setError('');
    if (files.length >= MAX_FILES) {
      setError(`A press kit can hold at most ${MAX_FILES} files.`);
      return;
    }
    if (browserFile.size > MAX_FILE_SIZE) {
      setError(`"${browserFile.name}" is larger than 10MB.`);
      return;
    }

    const fileType = guessFileType(browserFile);
    if (!FILE_TYPES.includes(fileType)) {
      setError(`Unsupported file type for "${browserFile.name}".`);
      return;
    }

    setUploadingNames(names => [...names, browserFile.name]);
    try {
      const fileUrl = await uploadFileAndGetUrl(browserFile);
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/services/press-release/${releaseId}/kit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ file_name: browserFile.name, file_url: fileUrl, file_type: fileType, file_size: browserFile.size }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add file to press kit.');

      setFiles(f => [...f, data.file]);
      onFileAdded?.(data.file);
    } catch (e) {
      setError(e.message || 'Upload failed.');
    }
    setUploadingNames(names => names.filter(n => n !== browserFile.name));
  }, [files.length, releaseId, onFileAdded]);

  const handleFiles = (fileList) => {
    Array.from(fileList).forEach(addFile);
  };

  const handleRemove = async (file) => {
    setError('');
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`${API_BASE}/services/press-release/${releaseId}/kit/${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove file.');
      setFiles(f => f.filter(x => x.id !== file.id));
      onFileRemoved?.(file.id);
    } catch (e) {
      setError(e.message || 'Failed to remove file.');
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
        className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
          dragActive ? 'border-ink bg-wire/10' : 'border-wire hover:border-ink-400'
        }`}
      >
        <UploadCloud size={28} className="text-ink-400 mx-auto mb-2" />
        <p className="text-xs font-bold uppercase tracking-wider text-ink-600">Drag files here or click to browse</p>
        <p className="text-[10px] font-medium text-ink-400 mt-1">Images, logos, PDFs, documents — up to 10MB, {MAX_FILES} files max</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-signal rounded-sm flex items-start gap-2">
          <AlertTriangle size={14} className="text-signal shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-signal">{error}</p>
        </div>
      )}

      {(files.length > 0 || uploadingNames.length > 0) && (
        <div className="mt-4 space-y-2">
          {files.map(file => {
            const Icon = iconFor(file.file_type);
            return (
              <div key={file.id} className="flex items-center gap-3 border border-wire bg-paper rounded-sm px-3 py-2">
                <Icon size={16} className="text-ink-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-ink truncate">{file.file_name}</p>
                  <p className="text-[10px] font-medium text-ink-400">{formatSize(file.file_size)} · {file.file_type}</p>
                </div>
                <button type="button" onClick={() => handleRemove(file)} className="p-1.5 rounded-sm hover:bg-wire/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal" title="Remove file">
                  <X size={14} className="text-ink-400" />
                </button>
              </div>
            );
          })}
          {uploadingNames.map(name => (
            <div key={name} className="flex items-center gap-3 border border-wire bg-paper rounded-sm px-3 py-2 opacity-70">
              <Loader2 size={16} className="text-ink-400 shrink-0 animate-spin" />
              <p className="text-xs font-bold text-ink truncate flex-1">{name}</p>
              <span className="text-[10px] font-medium text-ink-400">Uploading...</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
