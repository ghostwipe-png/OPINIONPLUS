'use client';

import { Facebook, Twitter, Youtube } from 'lucide-react';

const CHANNELS = [
  { Icon: Facebook, count: '16,569', label: 'Fans', action: 'LIKE', bg: 'bg-[#3b5998]' },
  { Icon: Twitter, count: '1,646', label: 'Followers', action: 'FOLLOW', bg: 'bg-[#00aced]' },
  { Icon: Youtube, count: '13,556', label: 'Subscribers', action: 'SUBSCRIBE', bg: 'bg-[#e52d27]' },
];

export default function SocialBar() {
  return (
    <div className="mb-8 w-full">
      {/* STAY CONNECTED Header */}
      <div className="relative border-t-2 border-ink pt-0">
        <div className="absolute -top-[2px] left-0 bg-ink text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 inline-block">
          Stay Connected
        </div>
      </div>
      
      {/* Social List */}
      <div className="flex flex-col gap-2 mt-10">
        {CHANNELS.map(({ Icon, count, label, action, bg }) => (
          <div 
            key={label} 
            className="flex items-center justify-between group cursor-pointer border border-wire/40 hover:bg-wire/20 transition-colors p-1.5 pr-4 rounded-sm"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${bg} flex items-center justify-center text-white rounded-sm transition-opacity group-hover:opacity-90`}>
                <Icon size={18} fill="currentColor" />
              </div>
              <div>
                <span className="font-bold text-ink text-sm block leading-none">{count}</span>
                <span className="text-[11px] font-medium text-ink-500">{label}</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-ink group-hover:text-signal transition-colors tracking-wide">
              {action}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}