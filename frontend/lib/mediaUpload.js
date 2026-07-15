'use client';

// Cloudinary unsigned upload widget for images/video. Requires
// NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
// (an unsigned preset created in the Cloudinary dashboard). See README.
export function openCloudinaryWidget({ onSuccess, resourceType = 'auto' }) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    // Dev-mode fallback: let the user pick a local file and preview it with
    // an object URL. This is NOT persisted anywhere — wire up Cloudinary to
    // make uploads real. See README "Cloudinary setup".
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = resourceType === 'video' ? 'video/*' : 'image/*,video/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) onSuccess({ url: URL.createObjectURL(file), name: file.name, devMode: true });
    };
    input.click();
    return;
  }

  if (!window.cloudinary) {
    console.error('Cloudinary widget script not loaded. Add the script tag from README to app/layout.js.');
    return;
  }

  const widget = window.cloudinary.createUploadWidget(
    { cloudName, uploadPreset: preset, resourceType, sources: ['local', 'url', 'camera'] },
    (error, result) => {
      if (!error && result.event === 'success') {
        onSuccess({ url: result.info.secure_url, name: result.info.original_filename });
      }
    }
  );
  widget.open();
}

// Uploads a document (PDF/DOC) to R2 via the Worker backend. In dev mode
// (no NEXT_PUBLIC_API_BASE configured) this falls back to a local object
// URL so the editor still works end-to-end without a backend running.
export async function uploadDocument(file) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE;
  if (!apiBase) {
    return { name: file.name, url: URL.createObjectURL(file), devMode: true };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${apiBase}/uploads/document`, { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) throw new Error('Upload failed');
  const data = await res.json();
  return { name: file.name, url: data.url };
}
