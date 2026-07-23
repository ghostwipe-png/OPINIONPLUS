// lib/mediaUpload.js
'use client';

/**
 * Formats file size into human-readable strings (e.g., "2.4 MB")
 */
export function formatFileSize(bytes) {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Enhanced Cloudinary Widget launcher with customized styling and multi-source support
 */
export function openCloudinaryWidget({ onSuccess, onError, resourceType = 'auto' }) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    // Advanced dev-mode fallback with rich metadata simulation
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = resourceType === 'video' ? 'video/*' : 'image/*,video/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        onSuccess({
          url: URL.createObjectURL(file),
          name: file.name,
          size: formatFileSize(file.size),
          type: file.type,
          devMode: true,
        });
      }
    };
    input.click();
    return;
  }

  if (!window.cloudinary) {
    const errorMsg = 'Cloudinary widget script not loaded. Add the script tag from README to app/layout.js.';
    console.error(errorMsg);
    if (onError) onError(errorMsg);
    return;
  }

  const widget = window.cloudinary.createUploadWidget(
    {
      cloudName,
      uploadPreset: preset,
      resourceType,
      sources: ['local', 'url', 'camera', 'google_drive', 'dropbox'],
      multiple: false,
      cropping: true,
      styles: {
        palette: {
          window: '#F9F8F6',
          windowBackground: '#FFFFFF',
          text: '#1C1917',
          action: '#E0492B',
          inactiveText: '#A8A29E',
          sourceBackground: '#F4F4F6'
        },
        fonts: {
          default: null
        }
      }
    },
    (error, result) => {
      if (error) {
        if (onError) onError(error);
        return;
      }
      if (result.event === 'success') {
        onSuccess({
          url: result.info.secure_url,
          name: result.info.original_filename || 'Uploaded File',
          format: result.info.format,
          size: formatFileSize(result.info.bytes),
          width: result.info.width,
          height: result.info.height,
        });
      }
    }
  );
  widget.open();
}

/**
 * Upgraded document/file upload utility supporting real-time progress tracking,
 * strict file validation (25MB limit), and gorgeous metadata handling.
 */
export function uploadDocument(file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    // File validation: 25MB max limit
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return reject(new Error('File size exceeds the 25MB limit. Please choose a smaller file.'));
    }

    const apiBase = process.env.NEXT_PUBLIC_API_BASE;
    if (!apiBase) {
      // Simulated progress for local dev mode
      let progress = 0;
      const interval = setInterval(() => {
        progress += 25;
        if (onProgress) onProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          resolve({
            name: file.name,
            size: formatFileSize(file.size),
            url: URL.createObjectURL(file),
            devMode: true,
          });
        }
      }, 150);
      return;
    }

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append('file', file);

    // Real-time upload progress tracking
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percent = Math.round((e.loaded * 100) / e.total);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            name: file.name,
            size: formatFileSize(file.size),
            url: data.url,
          });
        } catch (err) {
          reject(new Error('Invalid response format from server.'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || 'Upload failed'));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error occurred during upload. Please check your connection.'));
    });

    xhr.open('POST', `${apiBase}/uploads/document`);
    xhr.withCredentials = true;
    xhr.send(form);
  });
}