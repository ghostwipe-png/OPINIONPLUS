'use client';

import { useState, useEffect, useRef } from 'react';
import { Wallet, Users, Gift, ArrowUpRight, Copy, Check, Loader2, MessageCircle, Twitter, Trophy, Sparkles, Clock, CheckCircle2, Inbox } from 'lucide-react';
import { useAuth } from '../lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const POLL_INTERVAL_MS = 30000;

function SparkBars({ values = [] }) {
  const max = Math.max(1, ...values.map(v => v.total));
  return (
    <div className="flex items-end gap-2 h-24 pt-4 px-2">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5" title={`${v.label}: KES ${(v.total / 100).toFixed(0)}`}>
          <div className="w-full flex flex-col justify-end rounded-sm overflow-hidden bg-wire/20" style={{ height: '72px' }}>
            <div className="w-full bg-signal transition-all" style={{ height: `${Math.max(2, (v.referral / max) * 72)}px` }} />
            <div className="w-full bg-ink transition-all" style={{ height: `${Math.max(0, (v.post / max) * 72)}px` }} />
          </div>
          <span className="text-[10px] font-bold uppercase text-ink-500">{v.label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title, subtitle, cta }) {
  return (
    <div className="border border-dashed border-wire rounded-sm p-8 text-center bg-paper">
      <div className="w-12 h-12 bg-ink-50 rounded-full grid place-items-center mx-auto mb-3"><Icon size={20} className="text-ink-400" /></div>
      <p className="text-sm font-bold text-ink mb-1">{title}</p>
      {subtitle && <p className="text-xs text-ink-500 mb-4">{subtitle}</p>}
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
  const [historyFilter, setHistoryFilter] = useState('all');
  const [expandedItem, setExpandedItem] = useState(null);
  const balanceAnimRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(() => loadData({ silent: true }), POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

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
    } catch (e) {}
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
        setMessage(`Withdrawal of KES ${withdrawAmount} requested successfully.`);
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

  if (loading) return <p className="text-xs font-semibold text-ink-400">Loading wallet telemetry...</p>;

  const isAdmin = user?.role === 'admin' || user?.role === 'root';
  const isPartner = isAdmin || wallet?.tier === 'partner' || wallet?.tier === 'pro_partner';
  const balanceKes = (displayBalance / 100).toFixed(2);

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

  return (
    <div className="bg-white border border-wire rounded-sm p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-wire/60 pb-4 mb-6">
        <div className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 flex items-center gap-2">
          <Wallet size={14} /> Partner Wallet
        </div>
        {isPartner && (
          <span className="text-xs font-bold text-ink">
            Available: <span className="text-signal font-black text-sm">KES {balanceKes}</span>
          </span>
        )}
      </div>

      {!isPartner ? (
        <div className="bg-ink-50 border border-wire rounded-sm p-8 text-center space-y-4">
          <p className="text-base font-bold text-ink">Unlock Partner Earnings</p>
          <p className="text-xs font-medium text-ink-600 max-w-sm mx-auto">Join the Partner Program to monetize your readership through direct referrals and content engagement bonuses.</p>
          <a href="/pricing" className="inline-block bg-ink text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-sm hover:bg-signal transition-colors">
            View Partner Plans
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-wire bg-ink-50/50 rounded-sm p-4 text-center">
              <p className="text-2xl font-black text-ink">{wallet?.referral_count || 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">Referrals</p>
            </div>
            <div className="border border-wire bg-ink-50/50 rounded-sm p-4 text-center">
              <p className="text-2xl font-black text-ink">KES {((wallet?.total_earned || 0) / 100).toFixed(0)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">Total Earned</p>
            </div>
            <div className="border border-wire bg-ink-50/50 rounded-sm p-4 text-center">
              <p className="text-2xl font-black text-ink">KES {((wallet?.total_withdrawn || 0) / 100).toFixed(0)}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">Withdrawn</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button onClick={() => window.dispatchEvent(new CustomEvent('op:open-buy-credits'))} className="bg-ink text-white font-bold uppercase text-[11px] tracking-wider px-4 py-2.5 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5">
              <Sparkles size={13} /> Buy SMS Credits
            </button>
            <a href="/partner/leaderboard" className="border border-wire bg-paper text-ink font-bold uppercase text-[11px] tracking-wider px-4 py-2.5 rounded-sm hover:border-ink transition-colors flex items-center gap-1.5">
              <Trophy size={13} /> Leaderboard
            </a>
          </div>

          {/* Sparkline Chart */}
          <div className="border border-wire rounded-sm p-4 bg-paper">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Weekly Performance</p>
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-signal inline-block rounded-sm" /> Referrals</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-ink inline-block rounded-sm" /> Posts</span>
              </div>
            </div>
            <SparkBars values={last7} />
          </div>

          {/* Referral Link Box */}
          <div className="border border-wire rounded-sm p-5 bg-paper space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
              <Users size={14} className="text-signal" /> Your Exclusive Referral Link
            </p>
            <div className="flex gap-2">
              <code className="flex-1 bg-ink-50 border border-wire rounded-sm px-3 py-2 text-xs font-mono text-ink truncate">
                {shareLink}
              </code>
              <button onClick={copyReferralLink} className="bg-ink text-white font-bold uppercase text-xs px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={shareWhatsapp} className="border border-wire bg-paper hover:bg-ink-50 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm flex items-center gap-1.5 transition-colors">
                <MessageCircle size={13} className="text-emerald-600" /> Share WhatsApp
              </button>
              <button onClick={shareTwitter} className="border border-wire bg-paper hover:bg-ink-50 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm flex items-center gap-1.5 transition-colors">
                <Twitter size={13} className="text-sky-500" /> Share Twitter
              </button>
            </div>
          </div>

          {/* Withdrawal Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Payouts</p>
              <button onClick={() => setShowWithdraw(!showWithdraw)} className="bg-signal text-white font-bold uppercase text-[11px] tracking-wider px-4 py-2 rounded-sm hover:bg-signal/90 transition-colors">
                {showWithdraw ? 'Cancel' : 'Withdraw to M-Pesa'}
              </button>
            </div>

            {showWithdraw && (
              <div className="p-4 border border-wire bg-ink-50 rounded-sm space-y-3">
                <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Amount in KES (min 100)" type="number" className="w-full border border-wire rounded-sm px-3 py-2 text-xs font-medium bg-paper focus:outline-none focus:border-ink" />
                <input value={withdrawPhone} onChange={(e) => setWithdrawPhone(e.target.value)} placeholder="M-Pesa phone (+254...)" className="w-full border border-wire rounded-sm px-3 py-2 text-xs font-medium bg-paper focus:outline-none focus:border-ink" />
                <button onClick={requestWithdrawal} disabled={withdrawing} className="bg-ink text-white font-bold uppercase text-xs tracking-wider w-full py-2.5 rounded-sm hover:bg-signal transition-colors">
                  {withdrawing ? <Loader2 size={14} className="animate-spin inline" /> : `Confirm Withdrawal (Fee: KES 5)`}
                </button>
                {message && <p className="text-xs font-bold text-ink">{message}</p>}
              </div>
            )}

            {pendingWithdrawals.length > 0 && (
              <div className="space-y-2">
                {pendingWithdrawals.map(w => (
                  <div key={w.id} className="flex items-center justify-between p-3 border border-amber-300 bg-amber-50 rounded-sm text-xs font-bold text-amber-800">
                    <span className="flex items-center gap-2"><Clock size={14} className="animate-pulse" /> Payout Pending — KES {(w.amount / 100).toFixed(0)}</span>
                    <span>Processing</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Transaction History</p>
              <div className="flex gap-1">
                {['all', 'referrals', 'posts', 'withdrawals'].map(f => (
                  <button key={f} onClick={() => setHistoryFilter(f)} className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm border transition-colors ${historyFilter === f ? 'bg-ink text-white border-ink' : 'border-wire text-ink-600 hover:border-ink'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <EmptyState title="No transactions yet" subtitle="Your earnings and payouts will appear here." />
            ) : (
              <div className="border border-wire rounded-sm divide-y divide-wire bg-paper max-h-60 overflow-y-auto">
                {filteredHistory.map((item, i) => {
                  const key = `${item._type}-${item.id || i}`;
                  const label = item._type === 'referral' ? 'Referral Bonus' : item._type === 'post' ? 'Post Engagement' : 'Withdrawal Payout';
                  const amount = item._type === 'referral' ? item.bonus_paid : item.amount;
                  return (
                    <div key={key} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-ink">{label}</p>
                        <p className="text-[11px] font-medium text-ink-400 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`font-black ${item._type === 'withdrawal' ? 'text-signal' : 'text-emerald-600'}`}>
                        {item._type === 'withdrawal' ? '-' : '+'}KES {(Number(amount || 0) / 100).toFixed(0)}
                      </span>
                    </div>
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