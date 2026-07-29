// app/health/page.js
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Activity, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw, Clock, Database, Server, Shield } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function StatusIcon({ status }) {
  switch (status) {
    case 'ok': return <CheckCircle size={20} className="text-emerald-500" />;
    case 'degraded': return <AlertTriangle size={20} className="text-amber-500" />;
    case 'down': return <XCircle size={20} className="text-signal" />;
    default: return <Clock size={20} className="text-ink-300" />;
  }
}

function StatusBadge({ status }) {
  const styles = {
    ok: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    degraded: 'bg-amber-100 text-amber-700 border-amber-200',
    down: 'bg-red-100 text-signal border-red-200',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-sm border ${styles[status] || 'bg-ink-50 text-ink-500'}`}>
      {status === 'ok' ? 'Operational' : status === 'degraded' ? 'Degraded' : status === 'down' ? 'Down' : 'Unknown'}
    </span>
  );
}

export default function HealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      setHealth(data);
    } catch (e) {
      setError('Could not load platform status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const id = setInterval(fetchHealth, 30000);
    return () => clearInterval(id);
  }, [fetchHealth]);

  return (
    <div className="min-h-screen bg-paper py-16 px-5">
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 border-b-2 border-wire pb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-ink uppercase tracking-tight flex items-center gap-3">
            <Activity size={28} className="text-signal" /> Platform Status
          </h1>
          <p className="text-sm text-ink-500 font-medium mt-2">
            Real-time operational status of all OPINIONPLUS services.
          </p>
        </div>

        {loading && !health ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-signal" size={32} />
          </div>
        ) : error ? (
          <div className="border border-wire bg-white p-10 text-center rounded-sm">
            <AlertTriangle size={32} className="text-ink-300 mx-auto mb-4" />
            <p className="text-sm font-bold text-ink-600 uppercase tracking-wider">{error}</p>
            <button onClick={fetchHealth} className="mt-4 bg-ink text-white font-bold uppercase text-xs tracking-wider px-5 py-2.5 rounded-sm hover:bg-signal transition-colors flex items-center gap-2 mx-auto">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : health ? (
          <div className="space-y-8">
            {/* Overall Status Banner */}
            <div className={`border-2 rounded-sm p-6 ${
              health.overall === 'ok' ? 'border-emerald-200 bg-emerald-50/50' :
              health.overall === 'degraded' ? 'border-amber-200 bg-amber-50/50' :
              'border-red-200 bg-red-50/50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusIcon status={health.overall} />
                  <div>
                    <p className="text-lg font-black text-ink uppercase tracking-tight">
                      {health.overall === 'ok' ? 'All Systems Operational' :
                       health.overall === 'degraded' ? 'Some Systems Degraded' :
                       'Service Disruption Detected'}
                    </p>
                    <p className="text-xs text-ink-500 mt-1">
                      Last checked: {new Date(health.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button onClick={fetchHealth} className="text-xs font-bold uppercase tracking-wider text-ink hover:text-signal transition-colors flex items-center gap-1.5">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            </div>

            {/* Service Cards */}
            <div className="grid gap-4">
              {health.services?.map((service) => (
                <div key={service.provider} className="border border-wire bg-white p-5 rounded-sm flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      service.provider === 'd1_database' ? 'bg-blue-50' :
                      service.provider === 'bunny_stream' ? 'bg-purple-50' :
                      service.provider === 'paystack' ? 'bg-emerald-50' :
                      'bg-ink-50'
                    }`}>
                      {service.provider === 'd1_database' ? <Database size={18} className="text-blue-600" /> :
                       service.provider === 'bunny_stream' ? <Server size={18} className="text-purple-600" /> :
                       service.provider === 'paystack' ? <Shield size={18} className="text-emerald-600" /> :
                       <Activity size={18} className="text-ink-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-ink uppercase tracking-wide">
                        {service.provider.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-ink-400">
                        Latency: {service.latencyMs}ms
                        {service.statusCode ? ` · Status: ${service.statusCode}` : ''}
                      </p>
                      {service.message && (
                        <p className="text-[11px] text-ink-500 mt-0.5">{service.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={service.status} />
                    <StatusIcon status={service.status} />
                  </div>
                </div>
              ))}
            </div>

            {/* Uptime Summary */}
            <div className="border border-wire bg-white p-6 rounded-sm shadow-sm">
              <h3 className="text-sm font-black text-ink uppercase tracking-wide mb-4">About This Page</h3>
              <p className="text-xs text-ink-500 leading-relaxed">
                This page updates automatically every 30 seconds. OPINIONPLUS services are monitored 24/7.
                If you are experiencing issues not reflected here, please contact{' '}
                <a href="https://wa.me/254112696334" className="text-signal font-bold hover:underline" target="_blank" rel="noopener noreferrer">
                  support via WhatsApp
                </a>
                {' '}or email{' '}
                <a href="mailto:support@opinionplus.online" className="text-signal font-bold hover:underline">
                  support@opinionplus.online
                </a>.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-12 pt-8 border-t border-wire">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-ink hover:text-signal transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}