'use client';

import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, QrCode } from 'lucide-react';

export default function StoryQRCodeModal({ story }) {
  const [isOpen, setIsOpen] = useState(false);
  const qrRef = useRef();

  const storyUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/story/${story.id}` 
    : `https://opinionplus.online/story/${story.id}`;

  const downloadQRCode = () => {
    const svgElement = qrRef.current.querySelector('svg');
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 300, 300);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${story.slug || story.id}-qrcode.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-ink-600 hover:text-signal transition-colors py-1.5 px-3 border border-wire rounded-sm"
      >
        <QrCode size={14} /> QR Code
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-paper border border-wire rounded-sm max-w-sm w-full p-6 relative shadow-xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-ink-400 hover:text-ink transition-colors"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-ink mb-1">Story QR Code</h3>
            <p className="text-xs text-ink-500 mb-6 truncate">{story.title}</p>

            <div ref={qrRef} className="bg-white p-4 rounded-sm border border-wire flex justify-center mb-6">
              <QRCodeSVG value={storyUrl} size={220} level="H" includeMargin={true} />
            </div>

            <div className="flex gap-3">
              <button
                onClick={downloadQRCode}
                className="flex-1 bg-ink text-white font-bold uppercase text-xs tracking-wider py-3 rounded-sm hover:bg-signal transition-colors flex items-center justify-center gap-2"
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 border border-wire text-ink font-bold uppercase text-xs tracking-wider py-3 rounded-sm hover:border-ink transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}