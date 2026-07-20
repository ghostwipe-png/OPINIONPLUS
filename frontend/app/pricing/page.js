'use client';

import { useState } from 'react';
import { Check, Zap, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function PricingPage() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  const subscribe = async (tier) => {
    setLoading(tier);
    setError('');
    try {
      const ref = typeof window !== 'undefined' ? localStorage.getItem('op_referral') : null;
      const url = tier === 'partner' ? `${API_BASE}/partner/subscribe/partner` : `${API_BASE}/partner/subscribe/pro`;

      const csrfRes = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
      const csrfData = await csrfRes.json();

      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token || '',
        },
        body: JSON.stringify(ref ? { ref } : {}),
      });
      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error(data.error || 'Failed to initiate subscription gateway.');
      }
    } catch (e) {
      setError(e.message || 'Network error occurred. Please try again.');
    } finally {
      setLoading('');
    }
  };

  if (isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-32 text-center bg-paper min-h-[70vh] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-ink text-white rounded-sm grid place-items-center mx-auto mb-6 shadow-md">
          <ShieldCheck size={32} className="text-signal" />
        </div>
        <h1 className="text-3xl font-black mb-3 text-ink uppercase tracking-tight">Admin Access Active</h1>
        <p className="text-sm font-medium text-ink-600 mb-2 max-w-md">As an administrator, you have full access to all Partner and Pro features at no cost.</p>
        <p className="text-xs text-ink-400 font-mono">Use your privileges to assist publishers and manage the network.</p>
      </div>
    );
  }

  return (
    <div className="bg-paper min-h-screen py-16 pb-24">
      <div className="max-w-4xl mx-auto px-5">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="bg-ink text-white text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 inline-block rounded-sm mb-4">
            OPINIONPLUS Partner Network
          </span>
          <h1 className="text-4xl sm:text-5xl font-black text-ink tracking-tight mb-4">
            Monetize Your Truth & Readership
          </h1>
          <p className="text-base text-ink-600 font-medium leading-relaxed">
            Unlock professional earning features. Refer independent publishers, earn from content engagement, and withdraw payouts securely via M-Pesa.
          </p>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-8 bg-red-50 border border-signal text-signal p-4 rounded-sm text-xs font-bold uppercase tracking-wider text-center">
            {error}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto items-stretch">
          
          {/* Partner Tier */}
          <div className="bg-white border-2 border-wire rounded-sm p-8 flex flex-col shadow-sm transition-all hover:border-ink">
            <div className="mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400 block mb-1">Standard</span>
              <h2 className="text-2xl font-black text-ink">Partner</h2>
            </div>
            
            <div className="mb-6 pb-6 border-b border-wire">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-ink">KES 500</span>
                <span className="text-xs font-bold text-ink-400 uppercase">/ one-time</span>
              </div>
            </div>

            <ul className="space-y-4 text-xs font-bold uppercase tracking-wider text-ink-700 mb-8 flex-1">
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Earn KES 100 per referral</li>
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Earn from reader engagement</li>
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Secure withdrawals to M-Pesa</li>
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Full partner wallet dashboard</li>
            </ul>

            <button 
              onClick={() => subscribe('partner')} 
              disabled={loading === 'partner'} 
              className="w-full bg-ink text-white font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-signal transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {loading === 'partner' ? 'Redirecting to Gateway...' : 'Subscribe — KES 500'}
            </button>
          </div>

          {/* Pro Partner Tier */}
          <div className="bg-white border-2 border-ink rounded-sm p-8 flex flex-col relative shadow-xl">
            <div className="absolute -top-3.5 right-6 bg-signal text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-sm shadow-md">
              Best Value
            </div>

            <div className="mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-signal block mb-1">All-Inclusive</span>
              <h2 className="text-2xl font-black text-ink flex items-center gap-2">
                Pro Partner <Zap size={18} className="text-signal" fill="currentColor" />
              </h2>
            </div>
            
            <div className="mb-6 pb-6 border-b border-wire">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-ink">KES 800</span>
                <span className="text-xs font-bold text-ink-400 uppercase">/ one-time</span>
              </div>
            </div>

            <ul className="space-y-4 text-xs font-bold uppercase tracking-wider text-ink-700 mb-8 flex-1">
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Everything in Standard Partner</li>
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Unlimited developer API access</li>
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Worth KES 300/month standalone</li>
              <li className="flex items-center gap-3"><Check size={16} className="text-signal shrink-0" /> Dedicated priority support</li>
            </ul>

            <button 
              onClick={() => subscribe('pro')} 
              disabled={loading === 'pro'} 
              className="w-full bg-signal text-white font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {loading === 'pro' ? 'Redirecting to Gateway...' : 'Subscribe — KES 800'}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}