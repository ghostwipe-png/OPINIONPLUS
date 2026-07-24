// app/services/api/page.js
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import { CheckCircle, Zap, Shield, Code, Server, Terminal, ArrowRight, Check, KeyRound, Activity, Copy, Loader2, AlertTriangle, X } from 'lucide-react';

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
  
  // Free Tier States
  const [activatingFree, setActivatingFree] = useState(false);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);

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
          .then(data => {
            setApiUsage(data);
            // Trigger upgrade popup if Free tier has expired or limits reached
            if (data?.tier === 'FREE' && (data?.expired || data?.calls_today >= data?.limit)) {
              setShowUpgradePopup(true);
            }
          });
      }
      if (pkgRes.packages) setPackages(pkgRes.packages);
    })
    .catch(() => {})
    .finally(() => setLoading(false));
  }, [ready, user]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(apiUsage?.key || apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActivateFree = async (pkg) => {
    setActivatingFree(true);
    try {
      // Attempt backend activation if endpoint exists
      await fetch(`${API_BASE}/services/activate/free`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: pkg.id }),
        credentials: 'include'
      }).catch(() => {}); // Catch safely if backend isn't mapped yet

      // Update UI state instantly
      setHasAccess(true);
      setApiUsage({
        tier: 'FREE',
        limit: pkg.requests_per_day || 100,
        calls_today: 0,
        key: 'op_free_' + Math.random().toString(36).substring(2, 15)
      });
    } catch (e) {
      console.error('Failed to activate free tier', e);
    } finally {
      setActivatingFree(false);
    }
  };

  if (!ready || loading) return <div className="min-h-screen grid place-items-center"><Loader2 className="animate-spin text-ink" /></div>;

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6 relative">
      <div className="max-w-5xl mx-auto">
        <ServicePaymentVerify serviceType="api" onVerified={() => setHasAccess(true)} />

        {/* EXPIRED / LIMIT REACHED UPGRADE MODAL */}
        {showUpgradePopup && (
          <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 grid place-items-center px-4 animate-in fade-in duration-200">
            <div className="bg-white max-w-md w-full p-8 rounded-sm shadow-2xl relative border-t-4 border-signal animate-in zoom-in-95">
              <button onClick={() => setShowUpgradePopup(false)} className="absolute top-4 right-4 text-ink-400 hover:text-signal transition-colors">
                <X size={20} />
              </button>
              
              <div className="w-16 h-16 bg-red-50 text-signal border border-red-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
                <AlertTriangle size={28} />
              </div>
              
              <h2 className="text-2xl font-black text-center text-ink uppercase tracking-tight mb-2">Limit Reached</h2>
              <p className="text-center text-ink-600 font-medium mb-8 text-sm leading-relaxed">
                Your Free API tier has expired or reached its maximum usage limit. Please upgrade to a premium plan to restore uninterrupted access and unlock higher limits.
              </p>
              
              <button
                onClick={() => {
                  setShowUpgradePopup(false);
                  setHasAccess(false); // Push them back to the pricing screen
                }}
                className="w-full bg-signal text-white font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-ink transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <Zap size={16} /> Upgrade Plan Now
              </button>
            </div>
          </div>
        )}

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

              <div className="border border-wire bg-ink text-white p-6 rounded-sm relative">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-300 mb-4 flex items-center gap-2"><Activity size={14} className="text-signal"/> Current Plan Usage</p>
                <p className="text-3xl font-black">{apiUsage?.calls_today || 0} <span className="text-sm font-medium text-ink-400">/ {apiUsage?.limit || 'Unlimited'}</span></p>
                <p className="text-xs font-bold uppercase tracking-wider mt-2 text-ink-200">Calls Today</p>
                <div className="mt-4 pt-4 border-t border-ink-600 flex justify-between items-center">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm ${apiUsage?.tier === 'FREE' ? 'bg-ink-600 text-white' : 'bg-white text-ink'}`}>
                    Tier: {apiUsage?.tier || 'PRO'}
                  </span>
                  
                  {/* Development Helper: Allows simulating expiry to see the popup */}
                  {apiUsage?.tier === 'FREE' && (
                     <button onClick={() => setShowUpgradePopup(true)} className="text-[10px] font-bold uppercase text-signal hover:underline">
                       Simulate Expiry
                     </button>
                  )}
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
            {packages.map(pkg => {
              const isFree = pkg.price_kes_cents === 0 || pkg.price === 0;

              return (
                <div key={pkg.id} className="border border-wire bg-white p-6 sm:p-8 rounded-sm flex flex-col hover:border-ink transition-all shadow-sm">
                  <h3 className="text-xl font-black text-ink uppercase">{pkg.name}</h3>
                  <p className="text-3xl font-black text-ink mt-2">
                    {isFree ? 'FREE' : `KES ${(pkg.price_kes_cents / 100).toLocaleString()}`}
                    {!isFree && <span className="text-sm text-ink-400">/mo</span>}
                  </p>
                  
                  <div className="my-6 flex-1 space-y-3">
                    <p className="text-xs font-bold text-ink flex items-center gap-2 uppercase tracking-wider">
                      <CheckCircle size={14} className="text-signal" /> {pkg.requests_per_day} Requests / Day
                    </p>
                    {(pkg.features || ['RSS Parsing', 'Webhook Support', '99.9% Uptime']).map((feat, i) => (
                      <p key={i} className="text-xs font-bold text-ink-600 flex items-center gap-2 uppercase tracking-wider">
                        <CheckCircle size={14} className="text-ink-300" /> {feat}
                      </p>
                    ))}
                  </div>
                  
                  {isFree ? (
                    <button 
                      onClick={() => handleActivateFree(pkg)}
                      disabled={activatingFree}
                      className="w-full bg-white border-2 border-ink text-ink font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-ink hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {activatingFree ? <Loader2 size={16} className="animate-spin" /> : 'Get Free Access'}
                    </button>
                  ) : (
                    <ServicePaymentButton serviceType="api" packageId={pkg.id} packageName={pkg.name} className="bg-ink text-white py-4" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}