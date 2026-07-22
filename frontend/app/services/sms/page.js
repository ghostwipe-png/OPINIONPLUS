// frontend/app/services/sms/page.js
'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Users, FileText, Calendar, BarChart, Send, Check } from 'lucide-react';
import ServicePaymentButton from '../../../components/ServicePaymentButton';
import ServicePaymentVerify from '../../../components/ServicePaymentVerify';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SmsServicePage() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/services/packages/sms`)
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
      <ServicePaymentVerify serviceType="sms" />

      {/* Hero */}
      <div className="bg-ink text-white py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 bg-white/10 rounded-sm grid place-items-center mx-auto mb-6">
            <MessageSquare size={32} className="text-signal" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Bulk SMS Broadcasting</h1>
          <p className="text-lg text-white/80 font-medium max-w-2xl mx-auto">
            Reach your audience instantly with bulk SMS. Powered by Mobitech — Kenya's reliable SMS gateway.
          </p>
          <div className="inline-flex items-center gap-2 bg-signal/20 text-signal font-bold uppercase text-[10px] tracking-wider px-4 py-2 rounded-sm border border-signal/30">
            <Check size={14} /> All SMS sent with 'OpinionPlus' Sender ID
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-16 space-y-24">
        
        {/* Features */}
        <div>
          <h2 className="text-2xl font-black text-ink text-center mb-10">Everything you need to broadcast</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: FileText, title: 'CSV Contact Import', desc: 'Upload contacts instantly from Excel or CSV files.' },
              { icon: MessageSquare, title: 'Message Templates', desc: 'Save and reuse pre-built templates for common campaigns.' },
              { icon: Calendar, title: 'Schedule Messages', desc: 'Send immediately or schedule your campaigns for later.' },
              { icon: BarChart, title: 'Delivery Reports', desc: 'Track sent, delivered, and failed statuses in real-time.' },
              { icon: Users, title: 'Contact Management', desc: 'Save, organize, and segment your audiences.' },
              { icon: Send, title: 'Bulk Sending', desc: 'Reliably dispatch messages to thousands simultaneously.' }
            ].map((f, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 shrink-0 bg-ink-50 rounded-sm border border-wire grid place-items-center text-ink"><f.icon size={18} /></div>
                <div>
                  <h3 className="text-sm font-bold text-ink mb-1">{f.title}</h3>
                  <p className="text-xs font-medium text-ink-600">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="border border-wire bg-ink-50 rounded-sm p-8 sm:p-12">
          <h2 className="text-2xl font-black text-ink text-center mb-10">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-12 h-12 bg-signal text-white rounded-full grid place-items-center mx-auto mb-4 font-black text-lg shadow-sm">1</div>
              <h3 className="text-sm font-bold text-ink mb-2">Choose Package</h3>
              <p className="text-xs text-ink-600">Select an SMS bundle below and pay securely via M-Pesa or Card.</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-signal text-white rounded-full grid place-items-center mx-auto mb-4 font-black text-lg shadow-sm">2</div>
              <h3 className="text-sm font-bold text-ink mb-2">Upload Contacts</h3>
              <p className="text-xs text-ink-600">Access your dashboard to import CSVs or select saved audiences.</p>
            </div>
            <div>
              <div className="w-12 h-12 bg-signal text-white rounded-full grid place-items-center mx-auto mb-4 font-black text-lg shadow-sm">3</div>
              <h3 className="text-sm font-bold text-ink mb-2">Send Campaign</h3>
              <p className="text-xs text-ink-600">Compose your message and broadcast it instantly or schedule it.</p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div id="pricing">
          <h2 className="text-2xl font-black text-ink text-center mb-10">Select an SMS Bundle</h2>
          {loading ? (
            <div className="text-center text-ink-400 font-bold uppercase text-xs tracking-wider">Loading packages...</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg) => {
                const popular = pkg.sms_count === 1000;
                return (
                  <div key={pkg.id} className={`border-2 rounded-sm p-6 bg-white flex flex-col ${popular ? 'border-ink shadow-lg relative' : 'border-wire'}`}>
                    {popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-3 py-1 rounded-sm">Most Popular</span>}
                    <h3 className="text-lg font-bold text-ink mb-1">{pkg.name}</h3>
                    <p className="text-3xl font-black text-ink mb-6">{formatKes(pkg.price_kes_cents)}</p>
                    <div className="flex-1 space-y-3 mb-8">
                      <p className="text-xs font-bold text-ink flex items-center gap-2"><Check size={14} className="text-signal" /> {pkg.sms_count.toLocaleString()} Credits</p>
                      <p className="text-xs font-medium text-ink-600 flex items-center gap-2"><Check size={14} className="text-signal" /> Never expires</p>
                      <p className="text-xs font-medium text-ink-600 flex items-center gap-2"><Check size={14} className="text-signal" /> Delivery reports</p>
                    </div>
                    <ServicePaymentButton serviceType="sms" packageId={pkg.id} packageName={pkg.name} amount={pkg.price_kes_cents} className={popular ? 'bg-signal hover:bg-signal/90 text-white' : 'bg-ink hover:bg-ink/90 text-white'} />
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
              { q: 'What sender ID will my messages show?', a: 'All messages are broadcast using "OpinionPlus" as the verified alphanumeric sender ID.' },
              { q: 'How fast are messages delivered?', a: 'Our high-throughput gateway processes and delivers messages within seconds across all major networks.' },
              { q: 'Can I get delivery reports?', a: 'Yes, your dashboard provides real-time status tracking for every dispatched message.' },
              { q: 'Do credits expire?', a: 'No, purchased SMS credits remain in your account indefinitely until used.' },
              { q: 'What networks are supported?', a: 'We support all major Kenyan networks including Safaricom, Airtel, and Telkom.' }
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