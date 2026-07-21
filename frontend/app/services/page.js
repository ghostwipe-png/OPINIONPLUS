'use client';

import Link from 'next/link';
import { Terminal, Smartphone, Code2, Server, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

const services = [
  {
    id: 'fullstack',
    title: 'Full-Stack Web Development',
    description: 'Custom, high-performance web applications built from the ground up using modern frameworks like React, Next.js, and Cloudflare Workers for global scale.',
    icon: Code2,
  },
  {
    id: 'pwa',
    title: 'Progressive Web Apps (PWA)',
    description: 'Transform your platform into an installable, mobile-optimized experience. We build responsive PWAs that work seamlessly across all Android and iOS devices.',
    icon: Smartphone,
  },
  {
    id: 'ict-consulting',
    title: 'ICT Team & Tech Consulting',
    description: 'Empower your innovation company with expert technical guidance. We provide backend architecture consulting, API integrations, and system troubleshooting.',
    icon: Server,
  },
  {
    id: 'builder',
    title: 'Builder Web Services',
    description: 'End-to-end digital solutions including secure hosting configurations (InfinityFree, Cloudflare), domain management, and ongoing technical maintenance.',
    icon: Terminal,
  }
];

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-paper pb-24">
      
      {/* Hero Section */}
      <section className="bg-ink text-white py-24 relative overflow-hidden border-b-4 border-signal">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-transparent"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center sm:text-left">
          <div className="bg-signal text-white font-bold uppercase text-xs px-3 py-1.5 inline-flex items-center gap-2 rounded-sm mb-6 shadow-sm">
            <Zap size={14} className="fill-current" /> Professional Solutions
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight uppercase leading-none mb-4">
            Digital Engineering & <span className="text-transparent bg-clip-text bg-gradient-to-r from-signal to-white">Consulting</span>
          </h1>
          <p className="text-sm sm:text-base font-medium text-white/70 max-w-2xl leading-relaxed">
            Elevate your digital presence with enterprise-grade web development, custom PWA integrations, and expert Information and Communications Technology strategy tailored for innovation.
          </p>
        </div>
      </section>

      {/* Services Grid */}
      <section className="max-w-7xl mx-auto px-6 pt-16">
        <div className="flex items-center gap-3 border-b-2 border-wire pb-4 mb-10">
          <h2 className="text-2xl font-black uppercase tracking-tight text-ink flex items-center gap-2">
            Our Core Services
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {services.map((service) => (
            <div 
              key={service.id} 
              className="bg-white border-2 border-wire rounded-md p-8 hover:border-ink transition-colors shadow-sm group flex flex-col"
            >
              <div className="w-14 h-14 bg-ink-50 rounded-sm flex items-center justify-center text-ink mb-6 group-hover:bg-ink group-hover:text-white transition-colors shadow-inner border border-wire">
                <service.icon size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-ink mb-3">
                {service.title}
              </h3>
              <p className="text-sm font-medium text-ink-600 leading-relaxed mb-8 flex-1">
                {service.description}
              </p>
              
              <Link 
                href={`mailto:adipotech@gmail.com?subject=Inquiry regarding ${service.title}`}
                className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-signal hover:text-ink transition-colors mt-auto w-fit"
              >
                Request Consultation <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-6 pt-24">
        <div className="bg-ink-50 border-2 border-wire rounded-md p-10 sm:p-16 text-center shadow-inner">
          <ShieldCheck size={40} className="mx-auto text-signal mb-6" />
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-ink mb-4">Ready to launch your next project?</h2>
          <p className="text-sm font-medium text-ink-600 max-w-xl mx-auto mb-8 leading-relaxed">
            Whether you need a robust backend API routing system, seamless frontend components, or a fully installable mobile web app, we have the technical expertise to bring your vision to reality.
          </p>
          <Link 
            href="mailto:adipotech@gmail.com"
            className="bg-ink text-white font-bold uppercase text-xs tracking-widest px-8 py-4 rounded-sm hover:bg-signal transition-colors inline-block shadow-md hover:shadow-lg"
          >
            Contact Development Team
          </Link>
        </div>
      </section>
    </div>
  );
}