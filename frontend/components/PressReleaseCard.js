// components/PressReleaseCard.js
'use client';

import { Eye, Pencil, Rocket, Trash2, Share2, MessageSquareText, Clock, FileEdit } from 'lucide-react';

const STATUS_STYLES = {
  draft: 'bg-ink-100 text-ink-500',
  scheduled: 'bg-amber-50 text-amber-700 border border-amber-200',
  published: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  deleted: 'bg-red-50 text-signal border border-red-200',
};

function StatusBadge({ status }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft';
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>
      {label}
    </span>
  );
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function withinEditWindow(release) {
  if (!release.published_at) return true; // not yet published — always editable
  const publishedMs = new Date(release.published_at).getTime();
  return Date.now() - publishedMs <= 24 * 60 * 60 * 1000;
}

export default function PressReleaseCard({ release, showActions = false, onEdit, onDelete, onBoost, onView }) {
  const dateLabel = release.published_at || release.created_at;
  const canEdit = withinEditWindow(release);
  const analytics = release.analytics || {};

  return (
    <div className="border border-wire bg-white rounded-sm shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 shrink-0 rounded-sm bg-ink text-white grid place-items-center text-xs font-black uppercase">
          {initials(release.company)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={release.status} />
            {release.scheduled_at && release.status === 'scheduled' && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-ink-400 flex items-center gap-1">
                <Clock size={10} /> {new Date(release.scheduled_at).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-sm font-black text-ink line-clamp-2 mt-1">{release.title}</p>
          <p className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-0.5">{release.company}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0 text-ink-500">
        <div className="text-center">
          <p className="text-sm font-black text-ink flex items-center gap-1"><Eye size={12} /> {analytics.views || 0}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-300">Views</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-black text-ink flex items-center gap-1"><Share2 size={12} /> {analytics.shares || 0}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-300">Shares</p>
        </div>
        <div className="text-center hidden sm:block">
          <p className="text-sm font-black text-ink flex items-center gap-1"><MessageSquareText size={12} /> {analytics.sms_sent || 0}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-300">SMS</p>
        </div>
        <div className="text-center hidden md:block">
          <p className="text-[10px] font-bold text-ink-400">{dateLabel ? new Date(dateLabel).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {showActions && (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onView} title="View analytics" className="p-2 rounded-sm border border-wire hover:border-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            <Eye size={14} className="text-ink" />
          </button>
          <button onClick={onEdit} disabled={!canEdit} title={canEdit ? 'Edit release' : 'Edit window closed (24h)'} className="p-2 rounded-sm border border-wire hover:border-ink transition-colors disabled:opacity-30 disabled:hover:border-wire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            {canEdit ? <Pencil size={14} className="text-ink" /> : <FileEdit size={14} className="text-ink-300" />}
          </button>
          <button onClick={onBoost} title="Boost release" className="p-2 rounded-sm border border-wire hover:border-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            <Rocket size={14} className="text-signal" />
          </button>
          <button onClick={onDelete} title="Delete release" className="p-2 rounded-sm border border-wire hover:border-signal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            <Trash2 size={14} className="text-ink-400" />
          </button>
        </div>
      )}
    </div>
  );
}
