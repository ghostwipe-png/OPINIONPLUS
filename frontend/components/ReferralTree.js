import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Users, Share2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

function kes(cents) {
  return `KES ${(Math.round(cents || 0) / 100).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;
}

const TIER_DOT = {
  bronze: 'bg-red-500',
  silver: 'bg-slate-400',
  gold: 'bg-amber-500',
  platinum: 'bg-gray-400',
};

function Level2Node({ node }) {
  return (
    <div className="flex items-center gap-2 pl-6 border-l border-wire/50 py-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[node.partner_tier] || TIER_DOT.bronze}`} />
      <span className="text-sm text-ink/70">{node.publisher_name || 'Unnamed'}</span>
    </div>
  );
}

function Level1Node({ node }) {
  const [open, setOpen] = useState(false);
  const hasChildren = (node.referrals || []).length > 0;
  return (
    <div className="border border-wire bg-paper">
      <button
        onClick={() => hasChildren && setOpen(o => !o)}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5" />}
          <span className={`w-2 h-2 rounded-full ${TIER_DOT[node.partner_tier] || TIER_DOT.bronze}`} />
          <span className="text-sm font-medium text-ink">{node.publisher_name || 'Unnamed'}</span>
        </div>
        <span className="font-mono text-sm text-emerald-700">{kes(node.earnings_generated)}</span>
      </button>
      {open && hasChildren && (
        <div className="pb-2">
          {node.referrals.map((child) => <Level2Node key={child.id} node={child} />)}
        </div>
      )}
    </div>
  );
}

export default function ReferralTree() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/partner/referral-tree`, { credentials: 'include' })
      .then(res => { if (!res.ok) throw new Error('Could not load your referral tree.'); return res.json(); })
      .then(d => setTree(d.tree || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[0, 1, 2].map(i => <div key={i} className="h-12 bg-paper border border-wire" />)}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600 border border-wire bg-paper p-4">{error}</p>;
  }

  const totalReferrals = tree.length;
  const totalEarnings = tree.reduce((s, n) => s + (n.earnings_generated || 0), 0);
  const active = tree.filter(n => (n.referrals || []).length > 0 || n.earnings_generated > 0).length;

  if (totalReferrals === 0) {
    return (
      <div className="border border-wire bg-paper p-8 flex flex-col items-center gap-3 text-center">
        <Share2 size={20} className="text-ink/40" />
        <p className="text-sm text-ink/60">Share your link to grow your tree.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-wire bg-paper p-3 text-center">
          <p className="font-mono text-lg text-ink">{totalReferrals}</p>
          <p className="text-xs text-ink/50 uppercase">Referrals</p>
        </div>
        <div className="border border-wire bg-paper p-3 text-center">
          <p className="font-mono text-lg text-emerald-700">{kes(totalEarnings)}</p>
          <p className="text-xs text-ink/50 uppercase">Generated</p>
        </div>
        <div className="border border-wire bg-paper p-3 text-center">
          <p className="font-mono text-lg text-ink">{active}</p>
          <p className="text-xs text-ink/50 uppercase">Active</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-ink/60 text-sm">
        <Users size={14} /> You
      </div>
      <div className="space-y-2 overflow-x-auto">
        {tree.map((node) => <Level1Node key={node.id} node={node} />)}
      </div>
    </div>
  );
}