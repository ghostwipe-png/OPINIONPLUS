// components/AISummarizeButton.js
'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, Zap, TrendingUp, AlertTriangle, FileText, Clock } from 'lucide-react';

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

  // Try backend AI first, fall back to local summary
  const fetchAISummary = async () => {
    try {
      const csrfRes = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
      const csrfData = await csrfRes.json();
      
      const res = await fetch(`${API_BASE}/ai-services/summarize`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token || '',
        },
        body: JSON.stringify({
          storyId,
          title,
          text: (body || '').replace(/<[^>]*>/g, ' '),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.summary) {
          return data.summary;
        }
      }
    } catch (e) {
      // Backend unavailable — fall through to local summary
    }
    return null;
  };

  // Generate a simple extractive summary locally
  const generateLocalSummary = () => {
    const cleanText = (body || '').replace(/<[^>]*>/g, ' ').trim();
    
    // Get first 3 sentences as bullets
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [];
    const bullets = sentences
      .slice(0, 3)
      .map(s => s.trim())
      .filter(s => s.length > 10);
    
    // Word count and reading time
    const words = cleanText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readTime = Math.max(1, Math.round(wordCount / 200));
    
    // Simple sentiment analysis
    let sentiment = 'neutral';
    const lower = cleanText.toLowerCase();
    const positiveWords = ['win', 'success', 'growth', 'improve', 'celebrate', 'launch', 'achieve', 'gain', 'boost', 'rise', 'record'];
    const negativeWords = ['fail', 'crisis', 'loss', 'death', 'attack', 'protest', 'corruption', 'decline', 'drop', 'crash', 'war'];
    const posCount = positiveWords.filter(w => lower.includes(w)).length;
    const negCount = negativeWords.filter(w => lower.includes(w)).length;
    if (posCount > negCount + 1) sentiment = 'positive';
    if (negCount > posCount + 1) sentiment = 'negative';

    return {
      bullets: bullets.length > 0 
        ? bullets 
        : ['Read the full story for complete details and insights.'],
      keyTakeaway: `${wordCount.toLocaleString()} words · ${readTime} min read · ${sentences.length} sentences`,
      sentiment,
      local: true,
    };
  };

  const handleSummarize = async () => {
    if (summary) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Try backend AI first
      const aiSummary = await fetchAISummary();
      
      if (aiSummary) {
        setSummary(aiSummary);
      } else {
        // Fall back to local summary
        const localSummary = generateLocalSummary();
        setSummary(localSummary);
      }
      
      setExpanded(true);
      
      try {
        sessionStorage.setItem(`summary_${storyId}`, JSON.stringify(summary || generateLocalSummary()));
      } catch (e) {}
    } catch (e) {
      setError('Could not generate summary.');
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
        {loading ? 'Analyzing...' : summary ? (expanded ? 'Hide Summary' : 'Quick Summary') : 'Quick Summary'}
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
                <FileText size={12} /> Overview
              </p>
              <p className="text-sm font-bold text-ink">{summary.keyTakeaway}</p>
            </div>
          )}

          {/* Meta Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Sentiment Badge */}
            {summary.sentiment && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border ${sentimentColors[summary.sentiment] || sentimentColors.neutral}`}>
                <TrendingUp size={10} className="inline mr-1" />
                {summary.sentiment}
              </span>
            )}
            
            {/* Source badge */}
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border bg-ink-50 text-ink-500 border-wire`}>
              <Sparkles size={10} className="inline mr-1" />
              {summary.local ? 'Auto-generated' : 'AI-powered'}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-[11px] font-bold text-signal mt-2">{error}</p>
      )}
    </div>
  );
}