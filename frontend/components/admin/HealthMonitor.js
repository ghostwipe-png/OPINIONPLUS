'use client';

import { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, Loader2, RefreshCw } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

const STATUS_ICONS = {
  ok: CheckCircle,
  degraded: AlertTriangle,
  down: XCircle,
};

const STATUS_COLORS = {
  ok: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  degraded: 'text-amber-600 bg-amber-50 border-amber-200',
  down: 'text-signal bg-red-50 border-red-200',
};

export default function HealthMonitor() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState('unknown');

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setServices(data.services || []);
      setOverall(data.overall || 'unknown');
    } catch {
      setServices([]);
      setOverall('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHealth(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-ink">Platform Health Monitor</h2>
          <p className="text-xs text-ink-500 mt-0.5">Real-time status of all critical infrastructure services.</p>
        </div>
        <button onClick={fetchHealth} disabled={loading} className="border border-wire bg-white hover:border-ink px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
        </button>
      </div>

      <div className={`p-4 rounded-sm border text-sm font-bold uppercase tracking-wider flex items-center gap-3 ${
        overall === 'ok' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
        overall === 'degraded' ? 'bg-amber-50 border-amber-300 text-amber-800' :
        'bg-red-50 border-red-300 text-signal'
      }`}>
        {overall === 'ok' ? <CheckCircle size={20} /> : overall === 'degraded' ? <AlertTriangle size={20} /> : <XCircle size={20} />}
        System Status: {overall === 'ok' ? 'All Systems Operational' : overall === 'degraded' ? 'Degraded Performance' : 'Service Disruption Detected'}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin text-signal" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {services.map((s) => {
            const Icon = STATUS_ICONS[s.status] || Activity;
            return (
              <div key={s.provider} className={`border rounded-sm p-5 ${STATUS_COLORS[s.status] || 'border-wire'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-widest">{s.provider.replace(/_/g, ' ')}</span>
                  <Icon size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-black capitalize">{s.status}</p>
                  {s.latencyMs > 0 && <p className="text-xs font-mono">{s.latencyMs}ms latency</p>}
                  {s.message && <p className="text-xs font-medium mt-1">{s.message}</p>}
                  {s.statusCode && <p className="text-xs font-mono">HTTP {s.statusCode}</p>}
                </div>
              </div>
            );
          })}
          {services.length === 0 && (
            <div className="col-span-2 p-12 text-center border border-dashed border-wire rounded-sm">
              <Activity size={32} className="mx-auto text-ink-300 mb-3" />
              <p className="text-sm font-bold text-ink">No health data available</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}