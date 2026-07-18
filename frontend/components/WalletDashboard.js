'use client';

import { useState, useEffect } from 'react';
import { Wallet, Users, Gift, ArrowUpRight, Copy, Check, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function WalletDashboard() {
  const [wallet, setWallet] = useState(null);
  const [earnings, setEarnings] = useState({ referrals: [], posts: [], withdrawals: [] });
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [walletRes, earningsRes, refRes] = await Promise.all([
        fetch(`${API_BASE}/partner/wallet`, { credentials: 'include' }).then(r => r.json()),
        fetch(`${API_BASE}/partner/earnings`, { credentials: 'include' }).then(r => r.json()),
        fetch(`${API_BASE}/partner/referral-code`, { credentials: 'include' }).then(r => r.json()),
      ]);
      setWallet(walletRes);
      setEarnings(earningsRes);
      setReferralCode(refRes.code || '');
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`https://www.opinionplus.online/signup?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const requestWithdrawal = async () => {
    if (!withdrawAmount || !withdrawPhone) return;
    setWithdrawing(true);
    setMessage('');
    try {
      const res = await fetch(`${API_BASE}/partner/withdraw`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseInt(withdrawAmount) * 100, phone: withdrawPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Withdrawal of KES ${withdrawAmount} queued successfully!`);
        setWithdrawAmount('');
        setWithdrawPhone('');
        setShowWithdraw(false);
        loadData();
      } else {
        setMessage(data.error || 'Withdrawal failed.');
      }
    } catch (e) {
      setMessage('Something went wrong.');
    }
    setWithdrawing(false);
  };

  if (loading) return <p className="text-sm text-ink-400">Loading wallet...</p>;

  const isPartner = wallet?.tier === 'partner' || wallet?.tier === 'pro_partner';
  const balanceKes = ((wallet?.balance || 0) / 100).toFixed(2);

  return (
    <div className="rule mt-10 pt-8">
      <div className="flex items-center justify-between mb-5">
        <span className="wire-tag flex items-center gap-2"><Wallet size={14} /> Partner Wallet</span>
        {isPartner && (
          <span className="text-xs font-semibold text-ink-600">
            Balance: <span className="text-signal">KES {balanceKes}</span>
          </span>
        )}
      </div>

      {!isPartner ? (
        <div className="bg-ink-50 border border-wire rounded-sm p-4 text-center">
          <p className="text-sm font-semibold mb-2">Unlock earning features</p>
          <p className="text-xs text-ink-400 mb-4">Subscribe to the Partner Program to earn from referrals and engagement.</p>
          <div className="flex gap-3 justify-center">
            <a href="/pricing" className="btn-primary px-4 py-2 rounded-sm text-sm">View Plans</a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-wire rounded-sm p-3 text-center">
              <p className="text-xl font-bold editorial-h">{wallet?.referral_count || 0}</p>
              <p className="text-xs text-ink-400">Referrals</p>
            </div>
            <div className="border border-wire rounded-sm p-3 text-center">
              <p className="text-xl font-bold editorial-h">KES {((wallet?.total_earned || 0) / 100).toFixed(0)}</p>
              <p className="text-xs text-ink-400">Earned</p>
            </div>
            <div className="border border-wire rounded-sm p-3 text-center">
              <p className="text-xl font-bold editorial-h">KES {((wallet?.total_withdrawn || 0) / 100).toFixed(0)}</p>
              <p className="text-xs text-ink-400">Withdrawn</p>
            </div>
          </div>

          {/* Referral link */}
          <div>
            <p className="text-xs font-semibold mb-2 flex items-center gap-1"><Users size={12} /> Your Referral Link</p>
            <div className="flex gap-2">
              <code className="flex-1 bg-ink-50 border border-wire rounded-sm px-3 py-2 text-xs break-all">
                https://www.opinionplus.online/signup?ref={referralCode}
              </code>
              <button onClick={copyReferralLink} className="btn-outline px-3 py-2 rounded-sm text-xs">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-xs text-ink-400 mt-1">Earn KES 100 when someone subscribes using your link.</p>
          </div>

          {/* Withdraw */}
          <div>
            <button onClick={() => setShowWithdraw(!showWithdraw)} className="text-xs font-semibold text-signal flex items-center gap-1">
              <ArrowUpRight size={12} /> {showWithdraw ? 'Cancel' : 'Withdraw to M-Pesa'}
            </button>
            {showWithdraw && (
              <div className="mt-3 space-y-2 p-3 border border-wire rounded-sm">
                <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Amount (min KES 100)" type="number" className="w-full border border-wire rounded-sm px-3 py-2 text-sm" />
                <input value={withdrawPhone} onChange={(e) => setWithdrawPhone(e.target.value)} placeholder="M-Pesa number (+254...)" className="w-full border border-wire rounded-sm px-3 py-2 text-sm" />
                <button onClick={requestWithdrawal} disabled={withdrawing} className="btn-primary w-full py-2 rounded-sm text-sm">
                  {withdrawing ? <Loader2 size={14} className="animate-spin inline" /> : `Withdraw KES ${withdrawAmount || '0'} (Fee: KES 5)`}
                </button>
                {message && <p className="text-xs text-ink-600">{message}</p>}
              </div>
            )}
          </div>

          {/* Earnings log */}
          <details className="text-xs">
            <summary className="cursor-pointer text-ink-400 hover:text-ink-600">Earnings History</summary>
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
              {earnings.referrals.map(r => (
                <p key={r.id} className="text-ink-600">🎁 Referral bonus: KES {(r.bonus_paid / 100).toFixed(0)} · {new Date(r.created_at).toLocaleDateString()}</p>
              ))}
              {earnings.posts.map(p => (
                <p key={p.id} className="text-ink-600">📝 Post earnings: KES {(p.amount / 100).toFixed(0)} · {new Date(p.created_at).toLocaleDateString()}</p>
              ))}
              {earnings.withdrawals.map(w => (
                <p key={w.id} className="text-ink-600">💸 Withdrawal: KES {(w.amount / 100).toFixed(0)} · {w.status} · {new Date(w.created_at).toLocaleDateString()}</p>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}