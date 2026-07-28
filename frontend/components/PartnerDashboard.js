import { useEffect, useState, useCallback } from 'react';
import { Wallet, TrendingUp, Users, CalendarDays, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const TIER_STYLES = {
  bronze: 'bg-gradient-to-br from-red-50 via-red-100 to-red-200 border-red-600 text-red-900',
  silver: 'bg-gradient-to-br from-slate-100 to-slate-300 border-slate-400 text-slate-700',
  gold: 'bg-gradient-to-br from-amber-100 to-amber-300 border-amber-500 text-amber-900',
  platinum: 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 border-gray-500 text-gray-900',
};

function kes(cents) {
  return `KES ${(Math.round(cents || 0) / 100).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame;
    const start = performance.now();
    const duration = 700;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span>{kes(display)}</span>;
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="border border-wire bg-paper p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-ink/60">{label}</span>
        <Icon size={16} className={accent} />
      </div>
      <div className="font-mono text-2xl font-semibold text-ink">
        <CountUp value={value} />
      </div>
    </div>
  );
}

function MonthlyBars({ data }) {
  const max = Math.max(1, ...data.map(d => d.total));
  return (
    <div className="flex items-end gap-3 h-32 border border-wire bg-paper p-4">
      {data.length === 0 && <p className="text-sm text-ink/50">No earnings history yet.</p>}
      {data.map((d) => (
        <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
          <div
            className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400"
            style={{ height: `${Math.max(4, (d.total / max) * 88)}px` }}
            title={kes(d.total)}
          />
          <span className="text-[10px] text-ink/50 font-mono">{d.month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

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

export default function PartnerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [refCode, setRefCode] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [dashRes, codeRes] = await Promise.all([
        fetch(`${API_BASE}/partner/dashboard`, { credentials: 'include' }),
        fetch(`${API_BASE}/partner/referral-code`, { credentials: 'include' }),
      ]);
      if (!dashRes.ok) throw new Error('Could not load your dashboard.');
      setData(await dashRes.json());
      if (codeRes.ok) setRefCode(await codeRes.json());
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  const copyLink = () => {
    if (!refCode?.link) return;
    navigator.clipboard.writeText(refCode.link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-paper border border-wire" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-24 bg-paper border border-wire" />)}
        </div>
        <div className="h-32 bg-paper border border-wire" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-wire bg-paper p-6 flex flex-col items-center gap-3 text-center">
        <AlertTriangle size={20} className="text-red-600" />
        <p className="text-sm text-ink/70">{error}</p>
        <button onClick={load} className="border border-wire px-3 py-1.5 text-sm text-signal hover:bg-ink/5">
          Try again
        </button>
      </div>
    );
  }

  const tierStyle = TIER_STYLES[data.tier] || TIER_STYLES.bronze;
  const wallet = data.wallet || {};

  return (
    <div className="space-y-6">
      {/* Welcome + tier badge */}
      <div className="border border-wire bg-paper p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/50">Partner status</p>
          <p className="font-mono text-lg text-ink">{kes(wallet.balance)} available</p>
        </div>
        <div className={`px-4 py-2 border backdrop-blur-sm font-semibold text-sm uppercase tracking-wide ${tierStyle}`}>
          {data.tier} · {data.bonus_multiplier}x
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Wallet} label="Total earned" value={wallet.total_earned} accent="text-amber-600" />
        <StatCard icon={TrendingUp} label="Available balance" value={wallet.balance} accent="text-emerald-600" />
        <div className="border border-wire bg-paper p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-ink/60">Total referrals</span>
            <Users size={16} className="text-ink/50" />
          </div>
          <div className="font-mono text-2xl font-semibold text-ink">{data.referral_count}</div>
        </div>
        <StatCard
          icon={CalendarDays}
          label="This month"
          value={data.monthly_earnings?.[data.monthly_earnings.length - 1]?.total || 0}
          accent="text-ink/50"
        />
      </div>

      {/* Monthly chart */}
      <div>
        <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Monthly earnings</p>
        <MonthlyBars data={data.monthly_earnings || []} />
      </div>

      {/* Next tier progress */}
      {data.next_tier_progress && (
        <div className="border border-wire bg-paper p-4">
          <p className="text-sm text-ink">
            {data.next_tier_progress.referrals_needed > 0
              ? `${data.next_tier_progress.referrals_needed} more referral${data.next_tier_progress.referrals_needed === 1 ? '' : 's'} to reach ${data.next_tier_progress.tier}`
              : `You qualify for ${data.next_tier_progress.tier} — it updates at the next nightly recalculation.`}
          </p>
        </div>
      )}

      {/* Referral link + recent feed */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-wire bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Your referral link</p>
          <div className="flex items-center gap-2">
            <input readOnly value={refCode?.link || ''} className="flex-1 border border-wire bg-transparent px-2 py-1.5 text-sm font-mono text-ink" />
            <button onClick={copyLink} className="border border-wire px-3 py-1.5 text-signal hover:bg-ink/5">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>

        <div className="border border-wire bg-paper p-4">
          <p className="text-xs uppercase tracking-wide text-ink/50 mb-2">Recent earnings</p>
          {(!data.recent_earnings || data.recent_earnings.length === 0) ? (
            <p className="text-sm text-ink/50">No earnings yet — share your link to start.</p>
          ) : (
            <ul className="divide-y divide-wire/50">
              {data.recent_earnings.slice(0, 6).map((e, i) => (
                <li key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-ink/70">{EARNING_LABEL[e.earning_type] || e.earning_type}</span>
                  <span className="font-mono text-emerald-700">+{kes(e.amount_kes_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button onClick={load} className="flex items-center gap-1.5 text-xs text-ink/50 hover:text-ink">
        <RefreshCw size={12} /> Refresh
      </button>
    </div>
  );
}