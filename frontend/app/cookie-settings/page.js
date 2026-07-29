// app/cookie-settings/page.js
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cookie, Check, Shield, BarChart3, Settings } from 'lucide-react';

export default function CookieSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true, // Always on, can't be disabled
    analytics: true,
    functional: true,
  });

  const handleToggle = (key) => {
    if (key === 'essential') return; // Can't toggle essential
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    try {
      localStorage.setItem('op_cookie_prefs', JSON.stringify(preferences));
    } catch (e) {}
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRejectAll = () => {
    const minimal = { essential: true, analytics: false, functional: false };
    setPreferences(minimal);
    try {
      localStorage.setItem('op_cookie_prefs', JSON.stringify(minimal));
    } catch (e) {}
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAcceptAll = () => {
    const all = { essential: true, analytics: true, functional: true };
    setPreferences(all);
    try {
      localStorage.setItem('op_cookie_prefs', JSON.stringify(all));
    } catch (e) {}
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-paper py-16 px-5">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12 border-b-2 border-wire pb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-ink uppercase tracking-tight flex items-center gap-3">
            <Cookie size={28} className="text-signal" /> Cookie Settings
          </h1>
          <p className="text-sm text-ink-500 font-medium mt-2">
            Manage how OPINIONPLUS uses cookies and similar technologies.
          </p>
        </div>

        <div className="space-y-8">
          <p className="text-sm text-ink-700 leading-relaxed">
            We use cookies to provide essential platform functionality, analyze usage, and improve your experience.
            You can customize your preferences below. Essential cookies cannot be disabled as they are required
            for the platform to function.
          </p>

          {/* Essential Cookies */}
          <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
                  <Shield size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-ink uppercase tracking-wide">Essential Cookies</p>
                  <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                    Required for the platform to function. These handle authentication, security (CSRF protection),
                    and session management. Without these, you cannot sign in or publish content.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Session Token</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">CSRF Token</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Auth State</span>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="w-10 h-6 bg-emerald-500 rounded-full flex items-center px-0.5 cursor-not-allowed opacity-60">
                  <span className="w-5 h-5 rounded-full bg-white shadow translate-x-4" />
                </div>
                <span className="text-[9px] font-bold text-ink-400 text-center block mt-1">Always On</span>
              </div>
            </div>
          </div>

          {/* Analytics Cookies */}
          <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-purple-50 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 size={18} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-ink uppercase tracking-wide">Analytics Cookies</p>
                  <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                    Help us understand how the platform is used. We track page views, reading time, and feature usage
                    to improve the experience. No personal data is shared with third parties.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Page Views</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Reading Time</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Feature Usage</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleToggle('analytics')}
                className={`relative w-10 h-6 rounded-full transition-colors ${preferences.analytics ? 'bg-emerald-500' : 'bg-ink-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${preferences.analytics ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Functional Cookies */}
          <div className="border border-wire bg-white p-5 rounded-sm shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
                  <Settings size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-black text-ink uppercase tracking-wide">Functional Cookies</p>
                  <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                    Remember your preferences — like dark mode, reading preferences, saved articles, and notification settings.
                    These make your experience more personalized.
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Dark Mode</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Saved Articles</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-ink-50 border border-wire px-1.5 py-0.5 rounded-sm text-ink-400">Preferences</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleToggle('functional')}
                className={`relative w-10 h-6 rounded-full transition-colors ${preferences.functional ? 'bg-emerald-500' : 'bg-ink-200'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${preferences.functional ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 pt-4">
            <button
              onClick={handleAcceptAll}
              className="bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal transition-colors shadow-sm"
            >
              Accept All Cookies
            </button>
            <button
              onClick={handleRejectAll}
              className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:border-ink transition-colors"
            >
              Reject Non-Essential
            </button>
            <button
              onClick={handleSave}
              className="border border-wire bg-white text-ink font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:border-ink transition-colors flex items-center gap-2"
            >
              {saved ? <><Check size={14} className="text-emerald-500" /> Saved</> : 'Save Preferences'}
            </button>
          </div>

          {/* Saved confirmation */}
          {saved && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm text-sm font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-2">
              <Check size={16} /> Your cookie preferences have been saved.
            </div>
          )}

          <div className="text-xs text-ink-400 leading-relaxed pt-4 border-t border-wire">
            <p>
              For more information about how we handle your data, please read our{' '}
              <Link href="/privacy" className="text-signal font-bold hover:underline">Privacy Policy</Link> and{' '}
              <Link href="/terms" className="text-signal font-bold hover:underline">Terms of Service</Link>.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-wire">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-ink hover:text-signal transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}