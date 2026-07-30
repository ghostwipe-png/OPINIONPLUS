// components/AISummarizeButton.js
'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AISummarizeButton({ storyId, title, body }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  // Check cache on mount
  useEffect(() => {
    const cached = sessionStorage.getItem(`summary_${storyId}`);
    if (cached) {
      try {
        setSummary(JSON.parse(cached));
      } catch (e) {}
    }
  }, [storyId]);

  const handleSummarize = async () => {
    if (summary) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/ai-services/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          title,
          text: (body || '').replace(/<[^>]*>/g, ' '),
        }),
      });

      const data = await res.json();

      if (res.ok && data.summary) {
        setSummary(data.summary);
        setExpanded(true);
        try {
          sessionStorage.setItem(`summary_${storyId}`, JSON.stringify(data.summary));
        } catch (e) {}
      } else {
        setError(data.error || 'Could not generate summary.');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    }

    setLoading(false);
  };

  const sentimentColors = {
    positive: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    neutral: 'text-ink-500 bg-ink-50 border-wire',
    negative: 'text-signal bg-red-50 border-red-200',
  };

  return (
    <div className="relative">
      <button
        onClick={handleSummarize}
        disabled={loading}
        className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-purple-600 hover:text-purple-800 transition-colors border border-purple-200 rounded-sm px-3 py-2 hover:border-purple-400 bg-purple-50/50 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Sparkles size={13} />
        )}
        {loading ? 'Summarizing...' : summary ? (expanded ? 'Hide Summary' : 'AI Summary') : 'Summarize with AI'}
        {summary && !loading && (
          expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        )}
      </button>

      {/* Summary Card */}
      {summary && expanded && (
        <div className="mt-3 border border-purple-200 bg-purple-50/30 rounded-sm p-5 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Bullets */}
          <div className="space-y-2 mb-4">
            {summary.bullets?.map((bullet, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap size={11} className="text-purple-600" />
                </div>
                <p className="text-sm font-medium text-ink leading-relaxed">{bullet}</p>
              </div>
            ))}
          </div>

          {/* Key Takeaway */}
          {summary.keyTakeaway && (
            <div className="border-t border-purple-200 pt-3 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-purple-500 mb-1 flex items-center gap-1.5">
                <TrendingUp size={12} /> Key Takeaway
              </p>
              <p className="text-sm font-bold text-ink">{summary.keyTakeaway}</p>
            </div>
          )}

          {/* Sentiment Badge */}
          {summary.sentiment && (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border ${sentimentColors[summary.sentiment] || sentimentColors.neutral}`}>
                <AlertTriangle size={10} className="inline mr-1" />
                {summary.sentiment}
              </span>
              <span className="text-[10px] text-ink-400">AI-generated summary</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-[11px] font-bold text-signal mt-2">{error}</p>
      )}
    </div>
  );
}