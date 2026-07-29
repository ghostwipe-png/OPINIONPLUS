// app/press/page.js
'use client';

import Link from 'next/link';
import { Download, Mail, MessageCircle, Globe, Camera, FileText, Image } from 'lucide-react';

const PRESS_CONTACTS = [
  { label: 'Email', value: 'press@opinionplus.online', href: 'mailto:press@opinionplus.online', icon: Mail },
  { label: 'WhatsApp', value: '+254 112 696 334', href: 'https://wa.me/254112696334', icon: MessageCircle },
  { label: 'Website', value: 'www.opinionplus.online', href: 'https://www.opinionplus.online', icon: Globe },
];

const BRAND_ASSETS = [
  { name: 'Logo — Light Background (PNG)', description: 'Full color logo for light backgrounds', size: '240×80px', icon: Image },
  { name: 'Logo — Dark Background (PNG)', description: 'White logo for dark backgrounds', size: '240×80px', icon: Image },
  { name: 'Logo — Square Icon (PNG)', description: 'Square icon for social media profiles', size: '512×512px', icon: Image },
  { name: 'Brand Guidelines (PDF)', description: 'Colors, typography, logo usage rules', size: '2 pages', icon: FileText },
  { name: 'Screenshots Pack', description: 'Platform screenshots for press use', size: '5 images', icon: Camera },
];

const PRESS_RELEASES = [
  { date: 'July 2026', title: 'OPINIONPLUS Launches Partner Program — Publishers Can Now Earn from Content', href: '/services/press-release' },
  { date: 'June 2026', title: 'OPINIONPLUS Introduces Campus Editions — University-Specific News Platforms', href: '/campuses' },
  { date: 'May 2026', title: 'OPINIONPLUS API Goes Live — Developers Can Now Access News Streams', href: '/services/api' },
];

const PLATFORM_STATS = [
  { label: 'Active Publishers', value: '12,400+' },
  { label: 'Stories Published', value: '89,000+' },
  { label: 'Monthly Readers', value: '450,000+' },
  { label: 'Campus Editions', value: '89' },
  { label: 'Founded', value: '2025' },
  { label: 'Headquarters', value: 'Nairobi, Kenya' },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-paper py-16 px-5">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12 border-b-2 border-wire pb-6">
          <h1 className="text-3xl sm:text-4xl font-black text-ink uppercase tracking-tight">Press & Media Kit</h1>
          <p className="text-sm text-ink-500 font-medium mt-2">
            Brand assets, press contacts, and latest announcements from OPINIONPLUS.
          </p>
        </div>

        <div className="space-y-16">
          {/* About Section */}
          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-4">About OPINIONPLUS</h2>
            <p className="text-sm text-ink-700 leading-relaxed max-w-2xl">
              OPINIONPLUS is a Kenyan independent publishing platform that gives every voice its own dedicated masthead. 
              Journalists, documentary makers, companies, and universities publish stories, press releases, sponsored content, 
              and video broadcasts under their own brand — with their own logo, their own byline, and their own audience.
            </p>
          </section>

          {/* Platform Stats */}
          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-4">Platform by the Numbers</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {PLATFORM_STATS.map(stat => (
                <div key={stat.label} className="border border-wire bg-white p-5 rounded-sm text-center shadow-sm">
                  <p className="text-2xl font-black text-ink">{stat.value}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Press Contacts */}
          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-4">Press Contacts</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {PRESS_CONTACTS.map(contact => (
                <a
                  key={contact.label}
                  href={contact.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-wire bg-white p-5 rounded-sm text-center hover:border-ink hover:shadow-md transition-all group"
                >
                  <div className="w-12 h-12 bg-ink-50 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-ink group-hover:text-white transition-colors">
                    <contact.icon size={20} />
                  </div>
                  <p className="text-sm font-black text-ink uppercase tracking-wide">{contact.label}</p>
                  <p className="text-xs text-ink-500 mt-1 break-all">{contact.value}</p>
                </a>
              ))}
            </div>
          </section>

          {/* Brand Assets */}
          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-4">Brand Assets</h2>
            <p className="text-xs text-ink-500 mb-4">
              Download official OPINIONPLUS logos and brand materials for press use.
              For custom formats or questions, contact <a href="mailto:press@opinionplus.online" className="text-signal font-bold hover:underline">press@opinionplus.online</a>.
            </p>
            <div className="space-y-2">
              {BRAND_ASSETS.map(asset => (
                <div key={asset.name} className="border border-wire bg-white p-4 rounded-sm flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-ink-50 rounded-sm flex items-center justify-center">
                      <asset.icon size={18} className="text-ink-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">{asset.name}</p>
                      <p className="text-xs text-ink-400">{asset.description} · {asset.size}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => alert('Brand assets will be available for download soon. Please contact press@opinionplus.online for immediate access.')}
                    className="bg-ink text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2 rounded-sm hover:bg-signal transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Recent Press Releases */}
          <section>
            <h2 className="text-lg font-black text-ink uppercase tracking-wide mb-4">Recent Announcements</h2>
            <div className="space-y-2">
              {PRESS_RELEASES.map(release => (
                <Link
                  key={release.title}
                  href={release.href}
                  className="border border-wire bg-white p-4 rounded-sm flex items-center justify-between hover:border-ink transition-colors shadow-sm group"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{release.date}</span>
                    <p className="text-sm font-bold text-ink mt-1 group-hover:text-signal transition-colors">{release.title}</p>
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-signal group-hover:translate-x-1 transition-transform">Read →</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-wire">
          <Link href="/" className="text-xs font-bold uppercase tracking-wider text-ink hover:text-signal transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}