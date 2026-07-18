'use client';

import { useState } from 'react';
import { Check, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function PricingPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState('');

  const subscribe = async (tier) => {
    setLoading(tier);
    try {
      const url = tier === 'partner' ? `${API_BASE}/partner/subscribe/partner` : `${API_BASE}/partner/subscribe/pro`;
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      if (data.authorization_url) window.location.href = data.authorization_url;
    } catch (e) { /* ignore */ }
    setLoading('');
  };

  if (isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-32 text-center">
        <div className="w-16 h-16 bg-ink-50 rounded-full grid place-items-center mx-auto mb-4">
          <ShieldCheck size={32} className="text-ink-600" />
        </div>
        <p className="editorial-h text-2xl font-bold mb-2">Admin Access</p>
        <p className="text-sm text-ink-400 mb-1">As an admin, you have full access to all Partner and Pro features at no cost.</p>
        <p className="text-xs text-ink-400">Use this to assist publishers and manage the platform.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-16">
      <h1 className="editorial-h text-4xl font-black mb-4 text-center">Partner Program</h1>
      <p className="text-ink-400 text-center mb-12 max-w-lg mx-auto">Unlock earning features. Refer publishers, earn from engagement, withdraw to M-Pesa.</p>

      <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Partner */}
        <div className="border border-wire rounded-sm p-6 flex flex-col">
          <h2 className="editorial-h text-xl font-bold mb-2">Partner</h2>
          <p className="text-3xl font-black mb-4">KES 500</p>
          <p className="text-xs text-ink-400 mb-6">One-time payment</p>
          <ul className="space-y-2 text-sm mb-8 flex-1">
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Earn KES 100 per referral</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Earn from engagement</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Withdraw to M-Pesa</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Wallet dashboard</li>
          </ul>
          <button onClick={() => subscribe('partner')} disabled={loading === 'partner'} className="btn-primary w-full py-3 rounded-sm text-sm">
            {loading === 'partner' ? 'Redirecting...' : 'Subscribe — KES 500'}
          </button>
        </div>

        {/* Pro Partner */}
        <div className="border-2 border-ink rounded-sm p-6 flex flex-col relative">
          <span className="absolute -top-3 left-4 bg-signal text-white text-xs px-3 py-1 rounded-full font-semibold">Best Value</span>
          <h2 className="editorial-h text-xl font-bold mb-2 flex items-center gap-2">Pro Partner <Zap size={16} className="text-signal" /></h2>
          <p className="text-3xl font-black mb-4">KES 800</p>
          <p className="text-xs text-ink-400 mb-6">One-time payment</p>
          <ul className="space-y-2 text-sm mb-8 flex-1">
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Everything in Partner</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Unlimited API access</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Worth KES 300/month alone</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-ink-600" /> Priority support</li>
          </ul>
          <button onClick={() => subscribe('pro')} disabled={loading === 'pro'} className="btn-primary w-full py-3 rounded-sm text-sm">
            {loading === 'pro' ? 'Redirecting...' : 'Subscribe — KES 800'}
          </button>
        </div>
      </div>
    </div>
  );
}