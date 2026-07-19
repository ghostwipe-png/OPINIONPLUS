'use client';

import { useState, useEffect, useRef } from 'react';
import { Wallet, Users, Gift, ArrowUpRight, Copy, Check, Loader2, MessageCircle, Twitter, Trophy, Sparkles, Clock, CheckCircle2, Inbox } from 'lucide-react';
import { useAuth } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const POLL_INTERVAL_MS = 30000;

function SparkBars({ values = [] }) {
  const max = Math.max(1, ...values.map(v => v.total));
  return (
    <div className="flex items-end gap-2 h-20">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${v.label}: KES ${(v.total / 100).toFixed(0)}`}>
          <div className="w-full flex flex-col justify-end rounded-sm overflow-hidden" style={{ height: '64px' }}>
            <div className="w-full bg-ink" style={{ height: `${Math.max(2, (v.referral / max) * 64)}px` }} />
            <div className="w-full bg-ink-300" style={{ height: `${Math.max(0, (v.post / max) * 64)}px` }} />
          </div>
          <span className="text-[9px] text-ink-400">{v.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title, subtitle, cta }) {
  return (
    <div className="border border-dashed border-wire rounded-sm p-6 text-center">
      <div className="w-10 h-10 bg-ink-50 rounded-full grid place-items-center mx-auto mb-3"><Icon size={18} className="text-ink-400" /></div>
      <p className="text-sm font-semibold mb-1">{title}</p>
      {subtitle && <p className="text-xs text-ink-400 mb-3">{subtitle}</p>}
      {cta}
    </div>
  );
}

export default function WalletDashboard() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [earnings, setEarnings] = useState({ referrals: [], posts: [], withdrawals: [] });
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [message, setMessage] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all'); // all | referrals | posts | withdrawals
  const [expandedItem, setExpandedItem] = useState(null);
  const balanceAnimRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(() => loadData({ silent: true }), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Animate the balance counting up/down whenever wallet.balance changes.
  useEffect(() => {
    if (!wallet) return;
    const target = wallet.balance || 0;
    const start = displayBalance;
    const diff = target - start;
    if (diff === 0) return;
    if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current);
    const duration = 600;
    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      setDisplayBalance(Math.round(start + diff * progress));
      if (progress < 1) balanceAnimRef.current = requestAnimationFrame(step);
    };
    balanceAnimRef.current = requestAnimationFrame(step);
    return () => { if (balanceAnimRef.current) cancelAnimationFrame(balanceAnimRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.balance]);

  const loadData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
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
    if (!silent) setLoading(false);
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`https://www.opinionplus.online/signup?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = `https://www.opinionplus.online/signup?ref=${referralCode}`;
  const shareWhatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent('Join OPINIONPLUS using my link: ' + shareLink)}`, '_blank');
  const shareTwitter = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Join OPINIONPLUS using my link: ' + shareLink)}`, '_blank');

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

  const isAdmin = user?.role === 'admin' || user?.role === 'root';
  const isPartner = isAdmin || wallet?.tier === 'partner' || wallet?.tier === 'pro_partner';
  const balanceKes = (displayBalance / 100).toFixed(2);

  // Build last-7-days referral vs post earnings for the sparkline chart.
  const now = new Date();
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (6 - i));
    const isSame = (dateStr) => {
      const dd = new Date(dateStr);
      return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() && dd.getDate() === d.getDate();
    };
    const referral = earnings.referrals.filter(r => isSame(r.created_at)).reduce((s, r) => s + Number(r.bonus_paid || 0), 0);
    const post = earnings.posts.filter(p => isSame(p.created_at)).reduce((s, p) => s + Number(p.amount || 0), 0);
    return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), referral, post, total: referral + post };
  });

  const pendingWithdrawals = earnings.withdrawals.filter(w => w.status === 'pending' || w.status === 'processing');
  const completedWithdrawals = earnings.withdrawals.filter(w => w.status === 'completed');

  const combinedHistory = [
    ...earnings.referrals.map(r => ({ ...r, _type: 'referral' })),
    ...earnings.posts.map(p => ({ ...p, _type: 'post' })),
    ...earnings.withdrawals.map(w => ({ ...w, _type: 'withdrawal' })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const filteredHistory = historyFilter === 'all' ? combinedHistory :
    historyFilter === 'referrals' ? combinedHistory.filter(i => i._type === 'referral') :
    historyFilter === 'posts' ? combinedHistory.filter(i => i._type === 'post') :
    combinedHistory.filter(i => i._type === 'withdrawal');

  const conversionRate = wallet?.referral_count ? '—' : '—'; // no click-data available client-side; kept as placeholder metric

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
        <div className="space-y-6">
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

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => window.dispatchEvent(new CustomEvent('op:open-buy-credits'))} className="text-xs font-semibold px-3 py-2 rounded-sm bg-ink text-paper flex items-center gap-1"><Sparkles size={12} /> Buy SMS Credits</button>
            <a href="/partner/leaderboard" className="text-xs font-semibold px-3 py-2 rounded-sm border border-wire flex items-center gap-1"><Trophy size={12} /> View Leaderboard</a>
            {wallet?.tier === 'partner' && <a href="/pricing" className="text-xs font-semibold px-3 py-2 rounded-sm border border-wire flex items-center gap-1"><ArrowUpRight size={12} /> Upgrade to Pro</a>}
          </div>

          {/* Earnings chart */}
          <div className="border border-wire rounded-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-ink-400">Earnings — last 7 days</p>
              <div className="flex items-center gap-3 text-[10px] text-ink-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-ink inline-block rounded-sm" /> Referrals</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-ink-300 inline-block rounded-sm" /> Posts</span>
              </div>
            </div>
            <SparkBars values={last7} />
          </div>

          {/* Referral stats card */}
          <div className="border border-wire rounded-sm p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1"><Users size={12} /> Your Referral Link</p>
            <div className="flex gap-2 mb-3">
              <code className="flex-1 bg-ink-50 border border-wire rounded-sm px-3 py-2 text-xs break-all">
                {shareLink}
              </code>
              <button onClick={copyReferralLink} className="btn-outline px-3 py-2 rounded-sm text-xs">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={shareWhatsapp} className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-wire flex items-center gap-1"><MessageCircle size={12} /> WhatsApp</button>
              <button onClick={shareTwitter} className="text-xs font-semibold px-3 py-1.5 rounded-sm border border-wire flex items-center gap-1"><Twitter size={12} /> Twitter</button>
            </div>
            <p className="text-xs text-ink-400">Earn KES 100 when someone subscribes using your link. Total bonus earned: KES {((wallet?.total_earned || 0) / 100).toFixed(0)}.</p>
          </div>

          {/* Withdrawal tracker */}
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

            {pendingWithdrawals.length === 0 && completedWithdrawals.length === 0 ? (
              <div className="mt-3">
                <EmptyState icon={Clock} title="No withdrawals yet" subtitle="Once you request a payout, you can track its status here." />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {pendingWithdrawals.map(w => (
                  <div key={w.id} className="flex items-center justify-between p-2 border border-amber-200 bg-amber-50 rounded-sm text-xs">
                    <span className="flex items-center gap-1.5 text-amber-700"><Clock size={12} className="animate-pulse" /> Withdrawal in progress — KES {(w.amount / 100).toFixed(0)}</span>
                    <span className="text-amber-600">Est. within 24h</span>
                  </div>
                ))}
                {completedWithdrawals.slice(0, 3).map(w => (
                  <div key={w.id} className="flex items-center justify-between p-2 border border-wire rounded-sm text-xs">
                    <span className="flex items-center gap-1.5 text-ink-600"><CheckCircle2 size={12} /> Withdrawal complete — KES {(w.amount / 100).toFixed(0)}</span>
                    <span className="text-ink-400">{new Date(w.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filterable transaction history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-400 flex items-center gap-1"><Gift size={12} /> Earnings History</p>
              <div className="flex gap-1">
                {['all', 'referrals', 'posts', 'withdrawals'].map(f => (
                  <button key={f} onClick={() => setHistoryFilter(f)} className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${historyFilter === f ? 'bg-ink text-paper border-ink' : 'border-wire text-ink-600'}`}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <EmptyState icon={Inbox} title="Nothing here yet" subtitle="Your earnings and withdrawals will show up in this list." />
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {filteredHistory.map((item, i) => {
                  const key = `${item._type}-${item.id || i}`;
                  const isOpen = expandedItem === key;
                  const icon = item._type === 'referral' ? <Gift size={12} /> : item._type === 'post' ? <Sparkles size={12} /> : <ArrowUpRight size={12} />;
                  const label = item._type === 'referral' ? 'Referral bonus' : item._type === 'post' ? 'Post earnings' : 'Withdrawal';
                  const amount = item._type === 'referral' ? item.bonus_paid : item.amount;
                  return (
                    <button key={key} onClick={() => setExpandedItem(isOpen ? null : key)} className="w-full text-left p-2 border border-wire rounded-sm text-xs flex flex-col gap-1 hover:bg-ink-50">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-ink-600">{icon} {label}</span>
                        <span className="font-semibold">KES {(Number(amount || 0) / 100).toFixed(0)}</span>
                      </div>
                      <div className="flex items-center justify-between text-ink-400">
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                        {item._type === 'withdrawal' && <span>{item.status}</span>}
                      </div>
                      {isOpen && (
                        <div className="pt-1 mt-1 border-t border-wire text-ink-400 space-y-0.5">
                          {item._type === 'withdrawal' && <p>Phone: {item.phone}</p>}
                          {item._type === 'withdrawal' && item.withdrawal_reference && <p>Reference: {item.withdrawal_reference}</p>}
                          <p>Recorded: {new Date(item.created_at).toLocaleString()}</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
