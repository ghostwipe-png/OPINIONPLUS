// frontend/app/services/api/page.js
'use client';

import { useEffect, useState } from 'react';
import { Terminal, Database, Code2, Zap, Shield, FileJson } from 'lucide-react';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ApiServicePage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/services/packages/api`)
      .then(r => r.json())
      .then(data => {
        if (data.packages) setPackages(data.packages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatKes = (cents) => cents === 0 ? 'Free' : `KES ${(cents / 100).toLocaleString()} /mo`;

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
      <ServicePaymentVerify serviceType="api" />

      {/* Hero */}
      <div className="bg-ink text-white py-20 px-4 sm:px-6 border-b-4 border-signal">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-white/10 rounded-sm border border-white/20 grid place-items-center mx-auto mb-6 shadow-xl">
            <Terminal size={32} className="text-purple-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight font-mono">Developer API</h1>
          <p className="text-lg text-white/70 font-medium max-w-2xl mx-auto">
            Integrate OpinionPlus news pipelines into your application. Clean REST architecture, JSON responses, built for edge scale.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-16 space-y-20">
        
        {/* Features & Code Preview */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-black text-ink mb-4">Integrate in minutes</h2>
              <p className="text-sm text-ink-600 leading-relaxed">Consume our structured data feeds directly into your mobile apps, intranets, or custom dashboards. Protected by scalable Cloudflare Edge infrastructure.</p>
            </div>
            <div className="space-y-5">
              {[
                { icon: Database, title: 'RESTful Endpoints', desc: 'Predictable, resource-oriented URLs.' },
                { icon: FileJson, title: 'Strict JSON', desc: 'Clean, strongly-typed JSON responses without bloat.' },
                { icon: Shield, title: 'Key Authentication', desc: 'Secure Bearer token header authentication.' },
                { icon: Zap, title: 'Edge Performance', desc: 'Sub-50ms latency powered by global edge caching.' }
              ].map((f, i) => (
                <div key={i} className="flex gap-4">
                  <div className="mt-1 text-purple-600"><f.icon size={20} /></div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">{f.title}</h3>
                    <p className="text-xs font-medium text-ink-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-ink rounded-sm border border-wire shadow-2xl p-6 font-mono text-xs text-white overflow-hidden">
            <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <span className="ml-2 text-white/50">cURL Example</span>
            </div>
            <pre className="text-purple-300">
              <code>{`curl -X GET "https://api.opinionplus.online/v1/feed" \\`}</code><br/>
              <code>{`  -H "Authorization: Bearer op_sk_live_...9f8" \\`}</code><br/>
              <code>{`  -H "Accept: application/json"`}</code><br/>
            </pre>
            <div className="mt-6 border-t border-white/10 pt-4">
              <pre className="text-emerald-300">
                <code>{`{`}</code><br/>
                <code>{`  "status": "success",`}</code><br/>
                <code>{`  "data": [`}</code><br/>
                <code>{`    {`}</code><br/>
                <code>{`      "id": "st_8f7d9a",`}</code><br/>
                <code>{`      "title": "Nairobi Tech Week 2026",`}</code><br/>
                <code>{`      "published_at": "2026-07-22T08:00:00Z"`}</code><br/>
                <code>{`    }`}</code><br/>
                <code>{`  ]`}</code><br/>
                <code>{`}`}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div>
          <h2 className="text-2xl font-black text-ink text-center mb-10">Select API Tier</h2>
          {loading ? (
            <div className="text-center text-ink-400 font-bold uppercase text-xs tracking-wider">Loading packages...</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border border-wire rounded-sm p-8 bg-white hover:border-ink transition-all flex flex-col">
                  <h3 className="text-xl font-bold text-ink mb-1">{pkg.name}</h3>
                  <p className="text-xs font-mono text-ink-500 mb-6">{pkg.requests_per_day.toLocaleString()} reqs / day</p>
                  <p className="text-3xl font-black text-ink mb-8">{formatKes(pkg.price_kes_cents)}</p>
                  
                  <div className="flex-1 space-y-4 mb-8">
                    {(pkg.features || []).map((feature, i) => (
                      <p key={i} className="text-sm font-medium text-ink-700 flex items-start gap-3">
                        <Code2 size={16} className="text-purple-600 shrink-0 mt-0.5" /> 
                        {feature}
                      </p>
                    ))}
                  </div>
                  
                  {pkg.price_kes_cents === 0 ? (
                    <button className="w-full bg-white border border-wire hover:border-ink text-ink font-bold uppercase text-xs tracking-wider py-4 rounded-sm transition-colors">
                      Generate Free Key
                    </button>
                  ) : (
                    <ServicePaymentButton serviceType="api" packageId={pkg.id} packageName={pkg.name} amount={pkg.price_kes_cents} className="bg-ink hover:bg-ink/90 text-white w-full py-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}