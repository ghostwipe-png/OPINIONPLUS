'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import { MessageSquare, Send, Users, Smartphone, Loader2, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SmsServicePage() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState([]);
  
  // Dashboard State
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const fetchBalance = () => {
    fetch(`${API_BASE}/user/sms-credits`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => setBalance(data.balance || 0))
      .catch(() => {});
  };

  useEffect(() => {
    if (!ready || !user) {
      if (ready) setLoading(false);
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/services/packages/sms`).then(r => r.json())
    ])
    .then(([pkgRes]) => {
      if (pkgRes.packages) setPackages(pkgRes.packages);
    })
    .finally(() => {
      fetchBalance();
      setLoading(false);
    });
  }, [ready, user]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (balance <= 0) return alert('Insufficient SMS Credits. Please purchase a bundle.');
    
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/sms/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, message })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Messages dispatched successfully!');
        setRecipients('');
        setMessage('');
        fetchBalance(); // Refresh balance after sending
      } else {
        alert(data.error || 'Failed to send messages.');
      }
    } catch (e) {
      alert('Network error.');
    }
    setSending(false);
  };

  const recipientCount = recipients.split(',').filter(r => r.trim().length > 0).length;
  const cost = recipientCount; // 1 credit per recipient

  if (!ready || loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-ink" /></div>;

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <ServicePaymentVerify serviceType="sms" onVerified={() => fetchBalance()} />

        <div className="mb-8 border-b-2 border-wire pb-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-ink flex items-center gap-3 uppercase tracking-tight">
              <MessageSquare className="text-signal" size={28} /> SMS Broadcasting
            </h1>
            <p className="text-sm text-ink-500 font-medium mt-2">Send bulk alerts and news links directly to your subscribers' mobile devices.</p>
          </div>
          <div className="border-2 border-ink bg-white px-6 py-3 rounded-sm text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Available Credits</p>
            <p className="text-3xl font-black text-ink">{balance.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Dispatch Form */}
          <div className="lg:col-span-2 border border-wire bg-white p-6 sm:p-8 rounded-sm shadow-sm h-fit">
            <form onSubmit={handleSend} className="space-y-6">
              <div>
                <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                  <span className="flex items-center gap-2"><Users size={14} /> Recipient Phone Numbers</span>
                  <span className={recipientCount > 0 ? 'text-signal' : ''}>{recipientCount} numbers detected</span>
                </label>
                <textarea required value={recipients} onChange={e => setRecipients(e.target.value)} rows={3} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-mono bg-paper focus:outline-none focus:border-ink transition-colors resize-y" placeholder="+254700000000, +254711111111 (Comma separated)" />
              </div>
              
              <div>
                <label className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">
                  <span className="flex items-center gap-2"><Smartphone size={14} /> Message Body</span>
                  <span className={message.length > 160 ? 'text-signal' : ''}>{message.length} / 160 chars</span>
                </label>
                <textarea required value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:outline-none focus:border-ink transition-colors resize-y" placeholder="Type your broadcast message here..." />
              </div>

              <div className="bg-ink-50 border border-wire p-4 rounded-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">Estimated Cost</p>
                  <p className="text-xl font-black text-ink">{cost} Credits</p>
                </div>
                <button disabled={sending || cost > balance || cost === 0} type="submit" className="bg-signal text-white font-bold uppercase text-xs tracking-wider px-8 py-4 rounded-sm hover:bg-signal/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Dispatch SMS</>}
                </button>
              </div>
            </form>
          </div>

          {/* Top-up Store */}
          <div className="space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider mb-2 border-b border-wire pb-2">Top-Up Credit Bundles</h2>
            {packages.map(pkg => (
              <div key={pkg.id} className="border border-wire bg-white p-5 rounded-sm hover:border-ink transition-all shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-black text-ink uppercase">{pkg.name}</h3>
                  <p className="text-xs font-bold text-ink-500 mb-4">{pkg.sms_count} SMS Credits</p>
                  <p className="text-xl font-black text-ink mb-4">KES {(pkg.price_kes_cents / 100).toLocaleString()}</p>
                </div>
                <ServicePaymentButton serviceType="sms" packageId={pkg.id} packageName={pkg.name} className="bg-white border border-wire hover:bg-ink hover:text-white py-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}