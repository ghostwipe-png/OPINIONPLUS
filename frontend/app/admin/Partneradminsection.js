// 1. Import in admin/page.js: import PartnerAdminSection from './PartnerAdminSection';
// 2. Add tab: { id: 'partner-admin', label: 'Partners', icon: Users, visible: user?.role === 'root' }
// 3. Render: {tab === 'partner-admin' && isRoot && <PartnerAdminSection />}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, Banknote, TrendingUp, AlertTriangle, Search, Snowflake, Ban, PlusCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function kes(cents) {
  return `KES ${(Math.round(cents || 0) / 100).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

const SEVERITY_STYLE = {
  low: 'bg-slate-100 text-slate-700 border-slate-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-400',
  high: 'bg-orange-100 text-orange-800 border-orange-500',
  critical: 'bg-red-100 text-red-800 border-red-600',
};

function PinModal({ open, onClose, onConfirm, title }) {
  const [pin, setPin] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-wire p-5 w-full max-w-sm space-y-3">
        <p className="font-medium text-ink">{title}</p>
        <p className="text-xs text-ink/50">This action requires your admin PIN.</p>
        <input
          type="password" autoFocus value={pin} onChange={e => setPin(e.target.value)}
          className="w-full border border-wire bg-transparent px-2 py-1.5 text-sm font-mono text-ink"
          placeholder="Admin PIN"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="border border-wire px-3 py-1.5 text-sm text-ink/60 hover:bg-ink/5">Cancel</button>
          <button onClick={() => { onConfirm(pin); setPin(''); }} className="border border-wire px-3 py-1.5 text-sm text-signal hover:bg-ink/5">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function AdjustBalanceModal({ open, onClose, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
      <div className="bg-paper border border-wire p-5 w-full max-w-sm space-y-3">
        <p className="font-medium text-ink">Adjust balance</p>
        <div>
          <label className="text-xs uppercase tracking-wide text-ink/50">Amount (KES, use negative to deduct)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-wire bg-transparent px-2 py-1.5 text-sm font-mono text-ink mt-1" />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-ink/50">Reason</label>
          <input value={reason} onChange={e => setReason(e.target.value)} className="w-full border border-wire bg-transparent px-2 py-1.5 text-sm text-ink mt-1" />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="border border-wire px-3 py-1.5 text-sm text-ink/60 hover:bg-ink/5">Cancel</button>
          <button
            onClick={() => { onSubmit(Math.round(Number(amount) * 100), reason); setAmount(''); setReason(''); }}
            className="border border-wire px-3 py-1.5 text-sm text-signal hover:bg-ink/5"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

async function adminPost(path, body, pin) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(pin ? { 'X-Admin-Pin': pin } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Action failed.');
  return data;
}

export default function PartnerAdminSection() {
  const [stats, setStats] = useState(null);
  const [partners, setPartners] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [pinModal, setPinModal] = useState(null); // { action, args }
  const [adjustTarget, setAdjustTarget] = useState(null); // user_id

  const load = useCallback(() => {
    fetch(`${API_BASE}/partner/stats`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(setStats);
    fetch(`${API_BASE}/partner/admin/alerts`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(d => setAlerts(d?.alerts || []));
    fetch(`${API_BASE}/partner/admin/revenue`, { credentials: 'include' }).then(r => r.ok ? r.json() : null).then(setRevenue);
    // Partners table and pending withdrawals aren't backed by a dedicated list
    // endpoint yet — wire these up to your existing users/withdrawals admin
    // queries, or add a GET /partner/admin/partners route if you want this
    // table populated directly.
  }, []);

  useEffect(() => { load(); }, [load]);

  const runPinAction = async (path, args) => {
    setPinModal({ path, args });
  };

  const confirmPinAction = async (pin) => {
    if (!pinModal) return;
    try {
      await adminPost(pinModal.path, pinModal.args, pin);
      setPinModal(null);
      load();
    } catch (e) {
      setError(e.message);
      setPinModal(null);
    }
  };

  const bulkProcess = async () => {
    try {
      await fetch(`${API_BASE}/partner/withdraw/auto`, { method: 'POST', credentials: 'include' });
      load();
    } catch (e) { setError(e.message); }
  };

  const resolveAlert = async (id) => {
    await fetch(`${API_BASE}/partner/admin/alerts/${id}/resolve`, { method: 'POST', credentials: 'include' });
    load();
  };

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-ink">Partners</h2>
      {error && <p className="text-sm text-red-600 border border-wire bg-paper p-3">{error}</p>}

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="border border-wire bg-paper p-3">
          <p className="text-xs text-ink/50 uppercase">Total partners</p>
          <p className="font-mono text-lg text-ink">{stats?.active_partners_count ?? '—'}</p>
        </div>
        <div className="border border-wire bg-paper p-3">
          <p className="text-xs text-ink/50 uppercase">Total earned</p>
          <p className="font-mono text-lg text-emerald-700">{stats ? kes(stats.total_earned) : '—'}</p>
        </div>
        <div className="border border-wire bg-paper p-3">
          <p className="text-xs text-ink/50 uppercase">Platform revenue</p>
          <p className="font-mono text-lg text-amber-700">{revenue ? kes(revenue.total_kes_cents) : '—'}</p>
        </div>
        <div className="border border-wire bg-paper p-3">
          <p className="text-xs text-ink/50 uppercase">Pending withdrawals</p>
          <p className="font-mono text-lg text-ink">{stats ? kes(stats.total_pending) : '—'}</p>
        </div>
        <div className="border border-wire bg-paper p-3">
          <p className="text-xs text-ink/50 uppercase">Flagged alerts</p>
          <p className="font-mono text-lg text-red-600">{alerts.length}</p>
        </div>
      </div>

      {/* Partners table */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Search size={14} className="text-ink/40" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search partners by name or email…"
            className="border border-wire bg-transparent px-2 py-1.5 text-sm text-ink flex-1"
          />
        </div>
        <div className="border border-wire bg-paper overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-wire text-left text-xs uppercase tracking-wide text-ink/50">
                <th className="p-3">Partner</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Referrals</th>
                <th className="p-3">Balance</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-ink/40">
                  Wire this table to a GET /partner/admin/partners list endpoint to populate it — the row actions below are already functional.
                </td></tr>
              ) : partners.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase())).map((p) => (
                <tr key={p.id} className="border-b border-wire/50 last:border-0">
                  <td className="p-3 text-ink">{p.name}</td>
                  <td className="p-3 capitalize text-ink/70">{p.tier}</td>
                  <td className="p-3 font-mono text-ink/70">{p.referrals}</td>
                  <td className="p-3 font-mono text-ink/70">{kes(p.balance)}</td>
                  <td className="p-3 text-ink/70">{p.status}</td>
                  <td className="p-3 flex gap-2">
                    <button title="Freeze wallet" onClick={() => runPinAction('/partner/admin/freeze-wallet', { user_id: p.id, reason: 'Admin review' })} className="text-ink/50 hover:text-ink"><Snowflake size={14} /></button>
                    <button title="Ban partner" onClick={() => runPinAction('/partner/admin/ban-partner', { user_id: p.id, reason: 'Policy violation' })} className="text-red-500 hover:text-red-700"><Ban size={14} /></button>
                    <button title="Adjust balance" onClick={() => setAdjustTarget(p.id)} className="text-emerald-600 hover:text-emerald-800"><PlusCircle size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Withdrawals management */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-ink flex items-center gap-1.5"><Banknote size={14} /> Pending withdrawals</p>
          <button onClick={bulkProcess} className="border border-wire px-3 py-1.5 text-xs text-signal hover:bg-ink/5">Process all</button>
        </div>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-ink/50 border border-wire bg-paper p-4 text-center">No pending withdrawals.</p>
        ) : (
          <div className="border border-wire bg-paper divide-y divide-wire/50">
            {withdrawals.map(w => (
              <div key={w.id} className="flex items-center justify-between p-3 text-sm">
                <span className="font-mono text-ink">{kes(w.amount)}</span>
                <button onClick={() => adminPost(`/partner/withdrawal/${w.id}/complete`, {}).then(load)} className="border border-wire px-2 py-1 text-xs text-signal hover:bg-ink/5">
                  Mark complete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts feed */}
      <div>
        <p className="text-sm font-medium text-ink flex items-center gap-1.5 mb-2"><AlertTriangle size={14} /> Anomaly alerts</p>
        {alerts.length === 0 ? (
          <p className="text-sm text-ink/50 border border-wire bg-paper p-4 text-center">No open alerts.</p>
        ) : (
          <div className="border border-wire bg-paper divide-y divide-wire/50">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <span className={`text-xs px-2 py-0.5 border uppercase mr-2 ${SEVERITY_STYLE[a.severity] || SEVERITY_STYLE.low}`}>{a.severity}</span>
                  <span className="text-ink/70">{a.detail}</span>
                </div>
                <button onClick={() => resolveAlert(a.id)} className="border border-wire px-2 py-1 text-xs text-signal hover:bg-ink/5">Resolve</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Platform revenue */}
      {revenue && (
        <div>
          <p className="text-sm font-medium text-ink flex items-center gap-1.5 mb-2"><TrendingUp size={14} /> Platform revenue</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {revenue.by_source.map(s => (
              <div key={s.source} className="border border-wire bg-paper p-3">
                <p className="text-xs text-ink/50 uppercase">{s.source.replace(/_/g, ' ')}</p>
                <p className="font-mono text-ink">{kes(s.total)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <PinModal
        open={!!pinModal}
        title="Confirm admin action"
        onClose={() => setPinModal(null)}
        onConfirm={confirmPinAction}
      />
      <AdjustBalanceModal
        open={!!adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onSubmit={(amount_kes_cents, reason) => {
          setAdjustTarget(null);
          runPinAction('/partner/admin/adjust-balance', { user_id: adjustTarget, amount_kes_cents, reason });
        }}
      />
    </div>
  );
}