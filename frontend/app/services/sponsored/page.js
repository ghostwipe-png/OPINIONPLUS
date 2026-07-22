// frontend/app/services/sponsored/page.js
'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Target, Eye, BarChart2, Calendar, Layout } from 'lucide-react';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SponsoredPage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/services/packages/sponsored`)
      .then(r => r.json())
      .then(data => {
        if (data.packages) setPackages(data.packages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatKes = (cents) => `KES ${(cents / 100).toLocaleString()}`;

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
      <ServicePaymentVerify serviceType="sponsored" />

      {/* Hero */}
      <div className="bg-amber-100 border-b border-wire py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-white rounded-sm border border-wire grid place-items-center mx-auto mb-6 shadow-sm">
            <TrendingUp size={32} className="text-amber-600" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-ink">Sponsored Content Promotion</h1>
          <p className="text-lg text-ink-700 font-medium max-w-2xl mx-auto">
            Put your story where everyone sees it. Guaranteed top-feed placement with hard impression metrics.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-16 space-y-24">
        
        {/* Features */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { icon: Layout, title: 'Top Placement', desc: 'Your content is pinned securely at the top of the main feed.' },
            { icon: Eye, title: 'Guaranteed Impressions', desc: 'We deliver exact visibility metrics matching your tier goals.' },
            { icon: Target, title: 'Category Targeting', desc: 'Align your content with relevant industry categories.' },
            { icon: BarChart2, title: 'Real-time Analytics', desc: 'Monitor views, clicks, and interaction depth live.' },
            { icon: Layout, title: 'Transparent Badging', desc: 'Properly labeled to maintain platform trust and compliance.' },
            { icon: Calendar, title: 'Flexible Durations', desc: 'Run agile 7-day sprints or sustained 30-day campaigns.' }
          ].map((f, i) => (
            <div key={i} className="border border-wire p-6 rounded-sm bg-white hover:border-ink transition-colors flex flex-col gap-4">
              <div className="w-10 h-10 bg-amber-50 rounded-sm border border-amber-200 grid place-items-center text-amber-600"><f.icon size={18} /></div>
              <div>
                <h3 className="text-sm font-bold text-ink mb-1">{f.title}</h3>
                <p className="text-xs font-medium text-ink-600 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div>
          <h2 className="text-2xl font-black text-ink text-center mb-10">Select Campaign Duration</h2>
          {loading ? (
            <div className="text-center text-ink-400 font-bold uppercase text-xs tracking-wider">Loading packages...</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {packages.map((pkg) => (
                <div key={pkg.id} className="border border-wire rounded-sm p-8 bg-white hover:border-ink transition-all flex flex-col">
                  <h3 className="text-xl font-bold text-ink mb-2">{pkg.name}</h3>
                  <p className="text-4xl font-black text-ink mb-8">{formatKes(pkg.price_kes_cents)}</p>
                  
                  <div className="flex-1 space-y-4 mb-10">
                    <div className="flex justify-between items-center border-b border-wire pb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Duration</span>
                      <span className="text-sm font-black text-ink">{pkg.duration_days} Days</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-wire pb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Impressions Goal</span>
                      <span className="text-sm font-black text-signal">{pkg.impressions_goal.toLocaleString()}+</span>
                    </div>
                  </div>
                  
                  <ServicePaymentButton serviceType="sponsored" packageId={pkg.id} packageName={pkg.name} amount={pkg.price_kes_cents} className="bg-ink hover:bg-ink/90 text-white w-full py-3.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto border-t border-wire pt-16">
          <h2 className="text-2xl font-black text-ink text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              { q: 'Where exactly will my content appear?', a: 'Sponsored content is pinned into dedicated slots at the absolute top of the main feed and selected category feeds.' },
              { q: 'Is it marked as sponsored?', a: 'Yes, to comply with editorial standards, all promoted stories carry a clear "Sponsored" badge.' },
              { q: 'What happens if I don\'t reach the impressions goal?', a: 'If platform traffic fluctuates, we automatically extend your campaign duration for free until the impression guarantee is fully met.' }
            ].map((faq, i) => (
              <div key={i} className="bg-white border border-wire rounded-sm p-6">
                <h4 className="text-sm font-bold text-ink mb-2">{faq.q}</h4>
                <p className="text-sm font-medium text-ink-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}