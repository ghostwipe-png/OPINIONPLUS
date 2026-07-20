'use client';

import { useState, useEffect } from 'react';
import { BarChart2, CheckCircle2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function PollWidget({ pollId }) {
  const [poll, setPoll] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [votes, setVotes] = useState({});
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE}/polls/${pollId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.poll) {
          setPoll(data.poll);
          setVotes(data.votes || {});
          setTotalVotes(data.total || 0);
          if (data.userVoted !== undefined) {
            setHasVoted(true);
            setSelectedOption(data.userVoted);
          }
        }
      })
      .catch(() => {});
  }, [pollId]);

  const handleVote = async (index) => {
    if (hasVoted) return;
    setSelectedOption(index);
    setHasVoted(true);

    try {
      const res = await fetch(`${API_BASE}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndex: index }),
      });
      const data = await res.json();
      if (data.votes) {
        setVotes(data.votes);
        setTotalVotes(data.total);
      }
    } catch (e) {
      console.error('Vote failed:', e);
    }
  };

  if (!poll) return null;
  const options = JSON.parse(poll.options || '[]');

  return (
    <div className="bg-ink-50 border border-wire rounded-sm p-6 my-8 shadow-sm">
      <div className="flex items-center gap-2 text-signal text-xs font-bold uppercase tracking-wider mb-2">
        <BarChart2 size={14} /> Reader Opinion Poll
      </div>
      <h3 className="text-lg font-bold text-ink mb-4">{poll.question}</h3>

      <div className="space-y-3">
        {options.map((option, idx) => {
          const count = votes[idx] || 0;
          const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isSelected = selectedOption === idx;

          return (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={hasVoted}
              className={`w-full text-left relative overflow-hidden p-4 rounded-sm border transition-all ${
                isSelected ? 'border-signal bg-signal/5 font-bold' : 'border-wire bg-white hover:border-ink'
              }`}
            >
              {hasVoted && (
                <div
                  className="absolute top-0 bottom-0 left-0 bg-signal/15 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              )}
              <div className="relative flex items-center justify-between z-10">
                <span className="text-sm text-ink flex items-center gap-2">
                  {isSelected && <CheckCircle2 size={16} className="text-signal shrink-0" />}
                  {option}
                </span>
                {hasVoted && (
                  <span className="text-xs font-bold text-ink-500">{percentage}% ({count})</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] font-medium text-ink-400 mt-3 text-right">
        {totalVotes} total vote{totalVotes === 1 ? '' : 's'} · Verified secure poll
      </p>
    </div>
  );
}