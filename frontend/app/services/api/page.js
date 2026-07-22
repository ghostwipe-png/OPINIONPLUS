'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import { CheckCircle, Zap, Shield, Code, Server, Terminal, ArrowRight, Check, KeyRound, Activity, Copy, Loader2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ApiServicePage() {
  const { user, ready } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [packages, setPackages] = useState([]);
  
  // Dashboard State
  const [apiUsage, setApiUsage] = useState(null);
  const [apiKey, setApiKey] = useState('op_************************');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready || !user) {
      if (ready) setLoading(false);
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/services/check/api`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/services/packages/api`).then(r => r.json())
    ])
    .then(([checkRes, pkgRes]) => {
      if (checkRes.active) {
        setHasAccess(true);
        // Fetch specific API stats
        fetch(`${API_BASE}/payments/api-usage`, { credentials: 'include' })
          .then(r => r.json())
          .then(data => setApiUsage(data));
      }
      if (pkgRes.packages) setPackages(pkgRes.packages);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [ready, user]);

  const copyToClipboard = () => {
    // In a real scenario, you'd fetch the real key or it's provided in apiUsage
    navigator.clipboard.writeText(apiUsage?.key || apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!ready || loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-ink" /></div>;

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <ServicePaymentVerify serviceType="api" onVerified={() => setHasAccess(true)} />

        <div className="mb-8 border-b-2 border-wire pb-6">
          <h1 className="text-3xl font-black text-ink flex items-center gap-3 uppercase tracking-tight">
            <Server className="text-signal" size={28} /> Developer API Access
          </h1>
          <p className="text-sm text-ink-500 font-medium mt-2">Integrate OPINIONPLUS news streams and data parsing directly into your applications.</p>
        </div>

        {hasAccess ? (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="border border-wire bg-white p-6 rounded-sm col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4 flex items-center gap-2"><KeyRound size={14} className="text-signal"/> Production API Key</p>
                <div className="flex items-center gap-3 bg-paper border border-wire p-3 rounded-sm">
                  <code className="flex-1 font-mono text-sm text-ink font-bold">{apiUsage?.key || apiKey}</code>
                  <button onClick={copyToClipboard} className="bg-ink text-white p-2 rounded-sm hover:bg-signal transition-colors">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-[10px] font-bold uppercase text-signal tracking-wider mt-3">Keep this key secret. Do not expose it in client-side code.</p>
              </div>

              <div className="border border-wire bg-ink text-white p-6 rounded-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-300 mb-4 flex items-center gap-2"><Activity size={14} className="text-signal"/> Current Plan Usage</p>
                <p className="text-3xl font-black">{apiUsage?.calls_today || 0} <span className="text-sm font-medium text-ink-400">/ {apiUsage?.limit || 'Unlimited'} calls</span></p>
                <p className="text-xs font-bold uppercase tracking-wider mt-2 text-ink-200">Reset at midnight (EAT)</p>
                <div className="mt-4 pt-4 border-t border-ink-600">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-ink px-2 py-1 rounded-sm">Tier: {apiUsage?.tier || 'PRO'}</span>
                </div>
              </div>
            </div>

            <div className="border border-wire bg-white p-6 rounded-sm">
               <h3 className="text-sm font-bold uppercase tracking-wider text-ink mb-4">Quick Integration</h3>
               <pre className="bg-ink p-4 rounded-sm text-emerald-400 font-mono text-xs overflow-x-auto">
{`// Example Fetch
const response = await fetch('https://api.opinionplus.online/v1/feed', {
  headers: {
    'Authorization': 'Bearer ${apiUsage?.key || 'YOUR_API_KEY'}'
  }
});
const data = await response.json();`}
               </pre>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map(pkg => (
              <div key={pkg.id} className="border border-wire bg-white p-6 sm:p-8 rounded-sm flex flex-col hover:border-ink transition-all shadow-sm">
                <h3 className="text-xl font-black text-ink uppercase">{pkg.name}</h3>
                <p className="text-3xl font-black text-ink mt-2">KES {(pkg.price_kes_cents / 100).toLocaleString()}<span className="text-sm text-ink-400">/mo</span></p>
                <div className="my-6 flex-1 space-y-3">
                  <p className="text-xs font-bold text-ink flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={14} className="text-signal" /> {pkg.requests_per_day} Requests / Day</p>
                  {(pkg.features || ['RSS Parsing', 'Webhook Support', '99.9% Uptime']).map((feat, i) => (
                    <p key={i} className="text-xs font-bold text-ink-600 flex items-center gap-2 uppercase tracking-wider"><CheckCircle size={14} className="text-ink-300" /> {feat}</p>
                  ))}
                </div>
                <ServicePaymentButton serviceType="api" packageId={pkg.id} packageName={pkg.name} className="bg-ink text-white py-4" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}