// frontend/app/services/page.js
'use client';

import Link from 'next/link';
import { MessageSquare, FileText, TrendingUp, Terminal, ArrowRight } from 'lucide-react';

const SERVICES = [
  {
    id: 'sms',
    title: 'SMS Broadcasting',
    description: 'Reach thousands instantly with bulk SMS. Upload contacts, compose messages, schedule campaigns, and track delivery.',
    price: 'KES 50 for 100 SMS',
    icon: MessageSquare,
    color: 'text-signal',
    bg: 'bg-red-50',
    link: '/services/sms'
  },
  {
    id: 'press-release',
    title: 'Press Release Distribution',
    description: 'Publish your press releases on OpinionPlus. Get visibility, SMS blasts, and detailed analytics reports.',
    price: 'KES 1,000 per release',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    link: '/services/press-release'
  },
  {
    id: 'sponsored',
    title: 'Sponsored Content',
    description: 'Promote your story at the top of our feed. Guaranteed impressions, targeted visibility, and engagement analytics.',
    price: 'KES 1,000 for 7 days',
    icon: TrendingUp,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    link: '/services/sponsored'
  },
  {
    id: 'api',
    title: 'API Access',
    description: 'Integrate OpinionPlus content into your app. REST API, JSON responses, and developer-friendly documentation.',
    price: 'Free tier available',
    icon: Terminal,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    link: '/services/api'
  }
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-paper text-ink py-16 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Hero */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-ink">Grow with OpinionPlus</h1>
          <p className="text-lg text-ink-600 font-medium leading-relaxed">
            Amplify your reach, distribute your press releases, target your audience, and build upon our infrastructure with powerful platform services.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {SERVICES.map((srv) => (
            <div key={srv.id} className="border border-wire rounded-sm p-8 bg-white hover:border-ink hover:shadow-lg transition-all flex flex-col group">
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-14 h-14 shrink-0 rounded-sm grid place-items-center border border-wire ${srv.bg} ${srv.color} group-hover:scale-105 transition-transform`}>
                  <srv.icon size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink mb-1">{srv.title}</h2>
                  <p className="text-xs font-bold uppercase tracking-wider text-ink-400">Starting from {srv.price}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-ink-600 leading-relaxed mb-8 flex-1">
                {srv.description}
              </p>
              <Link href={srv.link} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink group-hover:text-signal transition-colors w-max">
                Learn More <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center pt-12 border-t border-wire">
          <p className="text-sm font-bold text-ink mb-4">Looking for enterprise solutions?</p>
          <Link href="/contact" className="border-2 border-ink text-ink hover:bg-ink hover:text-white font-bold uppercase text-xs tracking-wider px-8 py-3.5 rounded-sm transition-colors inline-block">
            Contact Sales Team
          </Link>
        </div>

      </div>
    </div>
  );
}