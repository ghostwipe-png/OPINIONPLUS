// app/services/api/page.js
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../../lib/auth';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';
import ApiUsageChart from '../../../components/ApiUsageChart';
import ApiKeyManager from '../../../components/ApiKeyManager';
import ApiRequestLogs from '../../../components/ApiRequestLogs';
import ApiDocsBrowser from '../../../components/ApiDocsBrowser';
import ApiWebhookConfig from '../../../components/ApiWebhookConfig';
import {
  Server, KeyRound, Activity, Eye, Book, Webhook, Bell, Code, Zap,
  Loader2, AlertTriangle, CheckCircle, X, Copy, Check, ShoppingBag,
} from 'lucide-react';

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

  // Tab State
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedKeyId, setSelectedKeyId] = useState(null);

  useEffect(() => {
    if (!ready || !user) {
      if (ready) setLoading(false);
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/api-service/check`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API_BASE}/api-service/packages`).then(r => r.json()),
    ])
      .then(([checkRes, pkgRes]) => {
        if (checkRes.active) {
          setHasAccess(true);
          fetch(`${API_BASE}/api-service/usage`, { credentials: 'include' })
            .then(r => r.json())
            .then(data => {
              setApiUsage(data);
              if (data?.tier === 'free' && data?.calls_today >= data?.limit) {
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
      const res = await fetch(`${API_BASE}/api-service/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_name: 'Free Tier Key',
          key_type: 'test',
          scopes: ['stories:read', 'press_release:read', 'sponsored:read', 'analytics:read'],
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok && data.key) {
        setHasAccess(true);
        setApiKey(data.key.key);
        setApiUsage({
          tier: 'free',
          limit: pkg.requests_per_day || 100,
          calls_today: 0,
        });
      } else {
        setHasAccess(true);
        setApiKey('op_test_' + Math.random().toString(36).substring(2, 15));
        setApiUsage({
          tier: 'free',
          limit: pkg.requests_per_day || 100,
          calls_today: 0,
        });
      }
    } catch (e) {
      console.error('Failed to activate free tier', e);
      setHasAccess(true);
      setApiKey('op_test_' + Math.random().toString(36).substring(2, 15));
      setApiUsage({
        tier: 'free',
        limit: pkg.requests_per_day || 100,
        calls_today: 0,
      });
    } finally {
      setActivatingFree(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="animate-spin text-ink" />
      </div>
    );
  }

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Server, visible: hasAccess },
    { id: 'keys', label: 'API Keys', icon: KeyRound, visible: hasAccess },
    { id: 'usage', label: 'Usage', icon: Activity, visible: hasAccess },
    { id: 'logs', label: 'Request Logs', icon: Eye, visible: hasAccess },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook, visible: hasAccess },
    { id: 'docs', label: 'Documentation', icon: Book, visible: hasAccess },
    { id: 'purchase', label: 'Purchase', icon: ShoppingBag, visible: !hasAccess },
  ];

  return (
    <div className="min-h-screen bg-paper py-12 px-4 sm:px-6 relative">
      <div className="max-w-5xl mx-auto">
        <ServicePaymentVerify serviceType="api" onVerified={() => setHasAccess(true)} />

        {/* UPGRADE POPUP */}
        {showUpgradePopup && (
          <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 grid place-items-center px-4">
            <div className="bg-white max-w-md w-full p-8 rounded-sm shadow-2xl relative border-t-4 border-signal">
              <button onClick={() => setShowUpgradePopup(false)} className="absolute top-4 right-4 text-ink-400 hover:text-signal transition-colors">
                <X size={20} />
              </button>
              <div className="w-16 h-16 bg-red-50 text-signal border border-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertTriangle size={28} />
              </div>
              <h2 className="text-2xl font-black text-center text-ink uppercase mb-2">Limit Reached</h2>
              <p className="text-center text-ink-600 font-medium mb-8 text-sm">
                Your Free API tier has reached its maximum usage limit. Please upgrade to a premium plan.
              </p>
              <button
                onClick={() => { setShowUpgradePopup(false); setHasAccess(false); }}
                className="w-full bg-signal text-white font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-ink transition-colors flex items-center justify-center gap-2"
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
          <p className="text-sm text-ink-500 font-medium mt-2">
            Integrate OPINIONPLUS news streams and data directly into your applications.
          </p>
        </div>

        {/* Tab Navigation */}
        {hasAccess && (
          <div className="flex flex-wrap gap-1 mb-8 border-b border-wire" role="tablist">
            {TABS.filter(t => t.visible).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-[11px] font-bold uppercase tracking-wider border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                    isActive ? 'border-signal text-ink' : 'border-transparent text-ink-400 hover:text-ink-600'
                  }`}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {hasAccess && activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="border border-wire bg-white p-6 rounded-sm col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-4 flex items-center gap-2">
                  <KeyRound size={14} className="text-signal" /> Production API Key
                </p>
                <div className="flex items-center gap-3 bg-paper border border-wire p-3 rounded-sm">
                  <code className="flex-1 font-mono text-sm text-ink font-bold">{apiKey}</code>
                  <button onClick={copyToClipboard} className="bg-ink text-white p-2 rounded-sm hover:bg-signal transition-colors">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-[10px] font-bold uppercase text-signal tracking-wider mt-3">
                  Keep this key secret. Do not expose it in client-side code.
                </p>
              </div>

              <div className="border border-wire bg-ink text-white p-6 rounded-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-300 mb-4 flex items-center gap-2">
                  <Activity size={14} className="text-signal" /> Current Plan
                </p>
                <p className="text-3xl font-black">
                  {apiUsage?.calls_today || 0} <span className="text-sm font-medium text-ink-400">/ {apiUsage?.limit || 'Unlimited'}</span>
                </p>
                <p className="text-xs font-bold uppercase tracking-wider mt-2 text-ink-200">Calls Today</p>
                <div className="mt-4 pt-4 border-t border-ink-600 flex justify-between items-center">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm ${apiUsage?.tier === 'free' ? 'bg-ink-600 text-white' : 'bg-white text-ink'}`}>
                    Tier: {apiUsage?.tier?.toUpperCase() || 'FREE'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border border-wire bg-white p-6 rounded-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-ink mb-4">Quick Integration</h3>
              <pre className="bg-ink p-4 rounded-sm text-emerald-400 font-mono text-xs overflow-x-auto">
{`// Example Fetch — Stories Endpoint
const response = await fetch('${API_BASE}/api-service/v1/stories', {
  headers: {
    'Authorization': 'Bearer ${apiKey || 'YOUR_API_KEY'}'
  }
});
const data = await response.json();

// Available endpoints:
// GET /api-service/v1/stories — List stories
// GET /api-service/v1/stories/:id — Get single story
// GET /api-service/v1/press-releases — List press releases
// GET /api-service/v1/press-releases/:id — Get single press release
// GET /api-service/v1/sponsored — List sponsored content`}
              </pre>
            </div>
          </div>
        )}

        {/* API KEYS TAB */}
        {hasAccess && activeTab === 'keys' && (
          <ApiKeyManager onKeyChange={(keys) => {
            if (keys.length > 0 && keys[0].id) setSelectedKeyId(keys[0].id);
          }} />
        )}

        {/* USAGE TAB */}
        {hasAccess && activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="border border-wire bg-white p-5 rounded-sm">
                <p className="text-2xl font-black text-ink">{apiUsage?.calls_today || 0}</p>
                <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Calls Today</p>
              </div>
              <div className="border border-wire bg-white p-5 rounded-sm">
                <p className="text-2xl font-black text-ink">{apiUsage?.limit || '—'}</p>
                <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Daily Limit</p>
              </div>
              <div className="border border-wire bg-white p-5 rounded-sm">
                <p className="text-2xl font-black text-ink">{apiUsage?.keys || 0}</p>
                <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Active Keys</p>
              </div>
              <div className="border border-wire bg-white p-5 rounded-sm">
                <p className="text-2xl font-black text-ink">{apiUsage?.tier?.toUpperCase() || 'FREE'}</p>
                <p className="text-[10px] font-bold uppercase text-ink-400 mt-1">Tier</p>
              </div>
            </div>
            <ApiUsageChart apiKeyId={selectedKeyId} days={7} />
          </div>
        )}

        {/* REQUEST LOGS TAB */}
        {hasAccess && activeTab === 'logs' && (
          <ApiRequestLogs apiKeyId={selectedKeyId} />
        )}

        {/* WEBHOOKS TAB */}
        {hasAccess && activeTab === 'webhooks' && (
          <ApiWebhookConfig />
        )}

        {/* DOCUMENTATION TAB */}
        {hasAccess && activeTab === 'docs' && (
          <ApiDocsBrowser />
        )}

        {/* PURCHASE TAB */}
        {(!hasAccess || activeTab === 'purchase') && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.length === 0 && (
              <p className="text-sm font-medium text-ink-500 col-span-3">No packages currently available.</p>
            )}
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