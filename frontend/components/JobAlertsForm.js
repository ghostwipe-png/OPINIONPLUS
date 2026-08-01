// components/JobAlertsForm.js
'use client';

import { useState } from 'react';
import { Bell, Mail, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const JOB_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship', 'Remote'];

export default function JobAlertsForm({ apiBase, fetchCsrfToken }) {
  const API_BASE = apiBase || process.env.NEXT_PUBLIC_API_BASE || '';

  const [email, setEmail] = useState('');
  const [jobTypes, setJobTypes] = useState(['Full-time']);
  const [frequency, setFrequency] = useState('weekly');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const toggleType = (type) => {
    setJobTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    // Prevent empty job types array
    if (jobTypes.length === 0) {
      setStatus('error');
      setMessage('Please select at least one job type.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const token = fetchCsrfToken ? await fetchCsrfToken() : '';
      const res = await fetch(`${API_BASE}/jobs/alerts/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token || '' },
        credentials: 'include',
        body: JSON.stringify({ email: email.trim(), job_types: jobTypes, frequency }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setStatus('success');
        setMessage(data.message || `Alert set! You'll receive ${frequency} updates.`);
        setEmail('');
        // Reset to defaults after successful subscription
        setJobTypes(['Full-time']);
        setFrequency('weekly');
      } else if (res.status === 429) {
        setStatus('error');
        setMessage(data.error || 'Too many attempts. Please try again later.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch (e) {
      setStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  };

  return (
    <div className="bg-[#1C1917] text-white rounded-2xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <Bell size={16} className="text-signal" />
        <h3 className="text-lg font-black uppercase tracking-tight">Get Job Alerts</h3>
      </div>
      <p className="text-xs text-white/60 mb-5">
        Get notified by email whenever new roles matching your preferences go live.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Your email address"
            className="w-full bg-white/10 rounded-lg pl-9 pr-3.5 py-3 text-xs font-semibold text-white placeholder:text-white/40 focus:outline-none focus:bg-white/15"
          />
        </div>

        <fieldset>
          <legend className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">Job Types</legend>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Select job types">
            {JOB_TYPE_OPTIONS.map((type) => (
              <label
                key={type}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                  jobTypes.includes(type) ? 'bg-signal text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={jobTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  className="sr-only"
                  aria-checked={jobTypes.includes(type)}
                />
                {type}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">Frequency</legend>
          <div className="flex gap-2" role="group" aria-label="Select alert frequency">
            {['daily', 'weekly'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                aria-pressed={frequency === f}
                className={`flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                  frequency === f ? 'bg-signal text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full bg-signal text-white font-bold uppercase text-[10px] tracking-wider py-3.5 rounded-full hover:bg-white hover:text-ink transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {status === 'loading' ? (
            <><Loader2 size={14} className="animate-spin" /> Subscribing...</>
          ) : (
            'Subscribe to Alerts'
          )}
        </button>

        {status === 'success' && (
          <p className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold" role="status">
            <CheckCircle2 size={13} aria-hidden="true" /> {message}
          </p>
        )}
        {status === 'error' && (
          <p className="flex items-center gap-1.5 text-red-400 text-[11px] font-semibold" role="alert">
            <AlertCircle size={13} aria-hidden="true" /> {message}
          </p>
        )}
      </form>
    </div>
  );
}