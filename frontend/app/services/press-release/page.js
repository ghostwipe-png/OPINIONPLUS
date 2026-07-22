// frontend/app/services/press-release/page.js
'use client';

import { useEffect, useState } from 'react';
import { Newspaper, Send, BarChart, Check, Image as ImageIcon, Briefcase, Mail, Calendar } from 'lucide-react';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function PressReleasePage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifiedOrder, setVerifiedOrder] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/services/packages/press_release`)
      .then(r => r.json())
      .then(data => {
        if (data.packages) setPackages(data.packages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const formatKes = (cents) => `KES ${(cents / 100).toLocaleString()}`;

  // If payment succeeded, show intake form
  if (verifiedOrder) {
    return (
      <div className="min-h-screen bg-paper py-16 px-4">
        <div className="max-w-2xl mx-auto border border-wire rounded-sm bg-white p-8 sm:p-12 shadow-xl">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full grid place-items-center mb-6">
            <Check size={24} />
          </div>
          <h2 className="text-2xl font-black text-ink mb-2">Payment Successful</h2>
          <p className="text-sm text-ink-600 mb-8">Your press release package is now active. Please submit your release details below for publishing.</p>
          
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); alert("Press Release submitted for review!"); }}>
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Headline</label><input required className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-bold bg-paper focus:border-ink outline-none" placeholder="Enter press release title" /></div>
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Company / Organization</label><div className="relative"><Briefcase size={16} className="absolute left-3.5 top-3.5 text-ink-400" /><input required className="w-full border border-wire rounded-sm pl-10 pr-4 py-3 text-sm font-medium bg-paper focus:border-ink outline-none" placeholder="e.g. Acme Corp" /></div></div>
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Contact Email</label><div className="relative"><Mail size={16} className="absolute left-3.5 top-3.5 text-ink-400" /><input type="email" required className="w-full border border-wire rounded-sm pl-10 pr-4 py-3 text-sm font-medium bg-paper focus:border-ink outline-none" placeholder="press@acmecorp.com" /></div></div>
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Press Release Content</label><textarea required rows={8} className="w-full border border-wire rounded-sm px-4 py-3 text-sm font-medium bg-paper focus:border-ink outline-none resize-none" placeholder="Write or paste your full press release here..." /></div>
            <div><label className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block mb-1">Featured Image URL (Optional)</label><div className="relative"><ImageIcon size={16} className="absolute left-3.5 top-3.5 text-ink-400" /><input type="url" className="w-full border border-wire rounded-sm pl-10 pr-4 py-3 text-sm font-medium bg-paper focus:border-ink outline-none" placeholder="https://..." /></div></div>
            <button type="submit" className="w-full bg-signal text-white font-bold uppercase text-xs tracking-wider py-4 rounded-sm hover:bg-signal/90 transition-colors shadow-sm">Submit for Publishing</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
      <ServicePaymentVerify serviceType="press_release" onVerified={setVerifiedOrder} />

      {/* Hero */}
      <div className="bg-blue-900 text-white py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-white/10 rounded-sm grid place-items-center mx-auto mb-6">
            <Newspaper size={32} className="text-blue-300" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Press Release Distribution</h1>
          <p className="text-lg text-blue-100 font-medium max-w-2xl mx-auto">
            Get your news on OpinionPlus. Published instantly, seen by thousands, and permanently archived.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-16 space-y-24">
        
        {/* Features */}
        <div>
          <h2 className="text-2xl font-black text-ink text-center mb-10">Maximize your brand's reach</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Check, title: 'Instant Publishing', desc: 'Your release goes live immediately upon review approval.' },
              { icon: Send, title: 'SMS Blasts', desc: 'Pro/Enterprise tiers blast your headline to engaged subscribers.' },
              { icon: BarChart, title: 'Analytics Report', desc: 'Get transparent data on views, reads, and engagement.' },
              { icon: Newspaper, title: 'Official Tagging', desc: 'Clearly marked with a "Press Release" tag for transparency.' },
              { icon: Calendar, title: '30-Day Visibility', desc: 'Remains in the primary feed ecosystem for a full 30 days.' },
              { icon: Share2Icon, title: 'Social Distribution', desc: 'Optimized link cards for easy sharing across social channels.' }
            ].map((f, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-blue-50 rounded-sm border border-blue-200 grid place-items-center text-blue-600"><f.icon size={18} /></div>
                <div>
                  <h3 className="text-sm font-bold text-ink mb-1">{f.title}</h3>
                  <p className="text-xs font-medium text-ink-600">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div>
          <h2 className="text-2xl font-black text-ink text-center mb-10">Choose Distribution Tier</h2>
          {loading ? (
            <div className="text-center text-ink-400 font-bold uppercase text-xs tracking-wider">Loading packages...</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {packages.map((pkg) => {
                const enterprise = pkg.name.toLowerCase() === 'enterprise';
                return (
                  <div key={pkg.id} className={`border-2 rounded-sm p-8 bg-white flex flex-col ${enterprise ? 'border-ink shadow-2xl relative scale-105 z-10' : 'border-wire'}`}>
                    {enterprise && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-3 py-1 rounded-sm">Maximum Reach</span>}
                    <h3 className="text-xl font-bold text-ink mb-2">{pkg.name}</h3>
                    <p className="text-4xl font-black text-ink mb-8">{formatKes(pkg.price_kes_cents)}</p>
                    <div className="flex-1 space-y-4 mb-8">
                      {(pkg.features || []).map((feature, i) => (
                        <p key={i} className="text-sm font-medium text-ink-700 flex items-start gap-3">
                          <Check size={16} className="text-blue-600 shrink-0 mt-0.5" /> 
                          {feature}
                        </p>
                      ))}
                    </div>
                    <ServicePaymentButton serviceType="press_release" packageId={pkg.id} packageName={pkg.name} amount={pkg.price_kes_cents} className={enterprise ? 'bg-signal hover:bg-signal/90 text-white py-4' : 'bg-ink hover:bg-ink/90 text-white py-4'} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto border-t border-wire pt-16">
          <h2 className="text-2xl font-black text-ink text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {[
              { q: 'How long until my release is published?', a: 'Submissions are reviewed and published within 1 hour during standard business hours.' },
              { q: 'Can I include images?', a: 'Yes, all tiers support one high-quality featured header image.' },
              { q: 'Will it show as sponsored content?', a: 'It is transparently labeled with an official "Press Release" tag, distinguishing it from editorial articles.' },
              { q: 'Can I edit it after publishing?', a: 'Yes, minor typographical edits can be requested within 24 hours of publication.' }
            ].map((faq, i) => (
              <div key={i} className="border-b border-wire pb-6">
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

function Share2Icon(props) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>;
}