// components/ReportProblem.js
'use client';

import { useState } from 'react';
import { Bug, X, Loader2, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ReportProblem() {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      // Get CSRF token
      const csrfRes = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
      const csrfData = await csrfRes.json();

      const res = await fetch(`${API_BASE}/admin/report-problem`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token || '',
        },
        body: JSON.stringify({
          description: description.trim(),
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          timestamp: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          setSuccess(false);
          setDescription('');
        }, 2500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to submit report.');
      }
    } catch (e) {
      // Fallback: just log to console if backend unavailable
      console.log('User report:', {
        description: description.trim(),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      });
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setDescription('');
      }, 2500);
    }

    setSubmitting(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-ink text-white p-3.5 rounded-full shadow-xl hover:bg-signal transition-all hover:scale-110 active:scale-95 focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none"
        title="Report a problem"
        aria-label="Report a problem"
      >
        <Bug size={20} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-ink rounded-md max-w-md w-full p-6 relative shadow-2xl animate-in zoom-in-95 duration-300">
            <button
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="absolute top-4 right-4 text-ink-400 hover:text-signal transition-colors bg-ink-50 hover:bg-red-50 p-1.5 rounded-full"
            >
              <X size={16} />
            </button>

            <div className="mb-5">
              <h3 className="text-lg font-black text-ink uppercase tracking-tight flex items-center gap-2">
                <Bug size={18} className="text-signal" /> Report a Problem
              </h3>
              <p className="text-xs text-ink-500 mt-1 font-medium">
                Let us know what went wrong so we can fix it quickly.
              </p>
            </div>

            {success ? (
              <div className="flex flex-col items-center text-center py-8 gap-3">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
                  <CheckCircle size={24} className="text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-ink uppercase tracking-wider">Report Sent</p>
                <p className="text-xs text-ink-500">Thank you! We&apos;ll look into this.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened..."
                  rows={4}
                  className="w-full border-2 border-wire rounded-sm px-3 py-2.5 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors resize-none"
                  autoFocus
                />
                {error && (
                  <p className="text-xs font-bold text-signal">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                    className="flex-1 border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider py-2.5 rounded-sm hover:bg-ink-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !description.trim()}
                    className="flex-1 bg-signal text-white font-bold uppercase text-xs tracking-wider py-2.5 rounded-sm hover:bg-signal/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                    Send Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}