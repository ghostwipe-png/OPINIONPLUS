'use client';

import { useEffect, useState, useCallback } from 'react';
import { LayoutDashboard, Users, Coins, Banknote, Award, Twitter, MessageCircle, Facebook, Copy, Check } from 'lucide-react';
import PartnerDashboard from '../../components/PartnerDashboard.js';
import ReferralTree from '../../components/ReferralTree.js';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function kes(cents) {
  return `KES ${(Math.round(cents || 0) / 100).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'referrals', label: 'Referrals', icon: Users },
  { id: 'earnings', label: 'Earnings', icon: Coins },
  { id: 'withdraw', label: 'Withdraw', icon: Banknote },
  { id: 'tiers', label: 'Tiers', icon: Award },
];

const EARNING_LABEL = {
  referral_basic: 'Referral (basic)',
  referral_partner: 'Referral (partner)',
  referral_pro: 'Referral (pro)',
  mlm_commission: 'Network commission',
  engagement_50: '50 views bonus',
  engagement_100: '100 views bonus',
  engagement_500: '500 views bonus',
  engagement_1000: '1,000 views bonus',
  quality_gold: 'Gold quality bonus',
  quality_silver: 'Silver quality bonus',
  likes_50: '50 likes bonus',
  comments_20: '20 comments bonus',
  admin_adjustment: 'Balance adjustment',
};

const CATEGORY_OF = (type) => {
  if (type.startsWith('referral') || type === 'mlm_commission') return 'referrals';
  if (type.startsWith('engagement') || type.startsWith('quality') || type.startsWith('likes') || type.startsWith('comments')) return 'engagement';
  if (type.startsWith('recurring')) return 'recurring';
  return 'other';
};

function ReferralsTab() {
  const [stats, setStats] = useState(null);
  const [refCode, setRefCode] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/partner/referral-stats`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/partner/referral-code`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([s, c]) => { setStats(s); setRefCode(c); });
  }, []);

  const copyLink = () => {
    if (!refCode?.link) return;
    navigator.clipboard.writeText(refCode.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const shareText = encodeURIComponent('Join me on OpinionPlus — sign up with my link:');
  const link = refCode?.link || '';

  return (
    <div className="space-y-6">
      <div className="border border-wire bg-paper p-4">
        <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Your referral link</p>
        <div className="flex items-center gap-2 mb-3">
          <input readOnly value={link} className="flex-1 border border-wire bg-transparent px-2 py-1.5 text-sm font-mono text-ink" />
          <button onClick={copyLink} className="border border-wire px-3 py-1.5 text-signal hover:bg-ink/5">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        </div>
        <div className="flex gap-2">
          <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="border border-wire p-2 hover:bg-ink/5"><Twitter size={16} /></a>
          <a href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="border border-wire p-2 hover:bg-ink/5"><MessageCircle size={16} /></a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="border border-wire p-2 hover:bg-ink/5"><Facebook size={16} /></a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-wire bg-paper p-3 text-center">
          <p className="font-mono text-lg text-ink">{stats?.total_clicks ?? '—'}</p>
          <p className="text-xs text-ink/50 uppercase">Clicks</p>
        </div>
        <div className="border border-wire bg-paper p-3 text-center">
          <p className="font-mono text-lg text-ink">{stats?.total_signups ?? '—'}</p>
          <p className="text-xs text-ink/50 uppercase">Signups</p>
        </div>
        <div className="border border-wire bg-paper p-3 text-center">
          <p className="font-mono text-lg text-ink">{stats ? `${stats.conversion_rate}%` : '—'}</p>
          <p className="text-xs text-ink/50 uppercase">Conversion</p>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Your network</p>
        <ReferralTree />
      </div>
    </div>
  );
}

function EarningsTab() {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/partner/dashboard`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setEntries(d?.recent_earnings || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? entries : entries.filter(e => CATEGORY_OF(e.earning_type) === filter);

  const exportCsv = () => {
    const rows = [['Type', 'Amount (KES)', 'Date'], ...filtered.map(e => [EARNING_LABEL[e.earning_type] || e.earning_type, (e.amount_kes_cents / 100).toFixed(2), e.created_at])];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'earnings.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {['all', 'referrals', 'engagement', 'recurring'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`border border-wire px-3 py-1.5 text-xs uppercase tracking-wide ${filter === f ? 'bg-ink text-paper' : 'text-ink/60 hover:bg-ink/5'}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={exportCsv} className="border border-wire px-3 py-1.5 text-xs text-signal hover:bg-ink/5">Export CSV</button>
      </div>

      {loading ? (
        <div className="h-40 bg-paper border border-wire animate-pulse" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-ink/50 border border-wire bg-paper p-6 text-center">No earnings in this category yet.</p>
      ) : (
        <div className="border border-wire bg-paper divide-y divide-wire/50">
          {filtered.map((e, i) => (
            <div key={i} className="flex items-center justify-between p-3 text-sm">
              <div>
                <p className="text-ink">{EARNING_LABEL[e.earning_type] || e.earning_type}</p>
                <p className="text-xs text-ink/40 font-mono">{new Date(e.created_at).toLocaleDateString()}</p>
              </div>
              <span className="font-mono text-emerald-700">+{kes(e.amount_kes_cents)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-800 border-amber-400',
  processing: 'bg-blue-100 text-blue-800 border-blue-400',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-400',
  failed: 'bg-red-100 text-red-800 border-red-400',
};

function WithdrawTab() {
  const [wallet, setWallet] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      fetch(`${API_BASE}/partner/wallet`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      fetch(`${API_BASE}/partner/dashboard`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]).then(([w, d]) => { setWallet(w); setWithdrawals(d?.withdrawals || []); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/partner/withdraw`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.round(Number(amount) * 100), phone, idempotency_key: crypto.randomUUID() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed.');
      setMessage({ type: 'ok', text: data.message });
      setAmount(''); setPhone('');
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-wire bg-paper p-4 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink/50">Available balance</span>
        <span className="font-mono text-xl text-ink">{kes(wallet?.balance)}</span>
      </div>

      <form onSubmit={submit} className="border border-wire bg-paper p-4 space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-ink/50">Amount (KES)</label>
          <input
            type="number" min="100" step="1" required value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full border border-wire bg-transparent px-2 py-1.5 text-sm font-mono text-ink mt-1"
          />
          <p className="text-xs text-ink/40 mt-1">Minimum withdrawal is KES 100. A withdrawal fee applies based on your tier.</p>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-ink/50">M-Pesa phone</label>
          <input
            type="tel" required placeholder="+254712345678" value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full border border-wire bg-transparent px-2 py-1.5 text-sm font-mono text-ink mt-1"
          />
        </div>
        {message && (
          <p className={`text-sm ${message.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>
        )}
        <button disabled={submitting} className="border border-wire px-4 py-2 text-signal hover:bg-ink/5 disabled:opacity-50">
          {submitting ? 'Submitting…' : 'Request withdrawal'}
        </button>
      </form>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Recent withdrawals</p>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-ink/50 border border-wire bg-paper p-4 text-center">No withdrawals yet.</p>
        ) : (
          <div className="border border-wire bg-paper divide-y divide-wire/50">
            {withdrawals.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <p className="font-mono text-ink">{kes(w.amount)}</p>
                  <p className="text-xs text-ink/40">{new Date(w.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 border uppercase tracking-wide ${STATUS_STYLE[w.status] || STATUS_STYLE.pending}`}>{w.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
const TIER_CARD_STYLE = {
  bronze: 'bg-gradient-to-br from-red-50 via-red-100 to-red-200 border-red-600',
  silver: 'bg-gradient-to-br from-slate-100 to-slate-300 border-slate-400',
  gold: 'bg-gradient-to-br from-amber-100 to-amber-300 border-amber-500',
  platinum: 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 border-gray-500',
};

function TiersTab() {
  const [tier, setTier] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/partner/tier`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(setTier);
  }, []);

  if (!tier) return <div className="h-40 bg-paper border border-wire animate-pulse" />;

  return (
    <div className="space-y-6">
      <div className={`border p-5 ${TIER_CARD_STYLE[tier.tier] || TIER_CARD_STYLE.bronze}`}>
        <p className="text-xs uppercase tracking-wide text-ink/60">Current tier</p>
        <p className="text-2xl font-semibold capitalize text-ink">{tier.tier}</p>
        <p className="text-sm text-ink/70 mt-1">{tier.bonus_multiplier}x earnings · {tier.withdrawal_fee === 0 ? 'no withdrawal fee' : `KES ${tier.withdrawal_fee / 100} withdrawal fee`}</p>
        {tier.next_tier && (
          <div className="mt-4">
            <div className="h-2 bg-ink/10">
              <div
                className="h-2 bg-emerald-600"
                style={{ width: `${Math.min(100, (tier.referral_count / tier.next_tier.referrals_required) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-ink/60 mt-1">
              {tier.next_tier.referrals_needed > 0
                ? `${tier.next_tier.referrals_needed} more referrals to ${tier.next_tier.name}`
                : `You qualify for ${tier.next_tier.name}`}
            </p>
          </div>
        )}
      </div>

      <div className="border border-wire bg-paper overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-wire text-left text-xs uppercase tracking-wide text-ink/50">
              <th className="p-3">Tier</th>
              <th className="p-3">Referrals</th>
              <th className="p-3">Multiplier</th>
              <th className="p-3">Withdrawal fee</th>
            </tr>
          </thead>
          <tbody>
            {TIER_ORDER.map((t) => (
              <tr key={t} className={`border-b border-wire/50 last:border-0 ${t === tier.tier ? 'bg-ink/5' : ''}`}>
                <td className="p-3 capitalize text-ink">{t}</td>
                <td className="p-3 font-mono text-ink/70">{tier.all_tiers[t].min}+</td>
                <td className="p-3 font-mono text-ink/70">{tier.all_tiers[t].multiplier}x</td>
                <td className="p-3 font-mono text-ink/70">{tier.all_tiers[t].fee === 0 ? 'Free' : `KES ${tier.all_tiers[t].fee / 100}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PartnerPage() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink mb-1">Partner Program</h1>
      <p className="text-sm text-ink/60 mb-6">Track referrals, earnings, and withdrawals.</p>

      <div className="flex gap-1 border-b border-wire mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 whitespace-nowrap ${
              activeTab === id ? 'border-signal text-ink font-medium' : 'border-transparent text-ink/50 hover:text-ink'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <PartnerDashboard />}
      {activeTab === 'referrals' && <ReferralsTab />}
      {activeTab === 'earnings' && <EarningsTab />}
      {activeTab === 'withdraw' && <WithdrawTab />}
      {activeTab === 'tiers' && <TiersTab />}
    </div>
  );
}