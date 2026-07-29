'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

function intensityClass(count) {
  if (count <= 0) return 'bg-wire/10';
  if (count === 1) return 'bg-ink/20';
  if (count <= 3) return 'bg-ink/40';
  if (count <= 5) return 'bg-ink/60';
  return 'bg-ink/80';
}

export default function ContentCalendar({ stories = [] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [hovered, setHovered] = useState(null);

  const countsByDay = useMemo(() => {
    const map = {};
    for (const s of stories) {
      const raw = s.createdAt || s.created_at;
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [stories]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const monthLabel = cursor.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  const totalThisMonth = Object.entries(countsByDay).reduce((sum, [key, count]) => {
    const [y, m] = key.split('-').map(Number);
    return y === year && m === month ? sum + count : sum;
  }, 0);

  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));

  return (
    <div className="bg-white border border-wire rounded-md p-6 md:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-signal" />
          <h3 className="text-sm font-black uppercase tracking-widest text-ink">{monthLabel}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            aria-label="Previous month"
            className="p-2 rounded-sm border border-wire hover:bg-ink-50 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goNext}
            aria-label="Next month"
            className="p-2 rounded-sm border border-wire hover:bg-ink-50 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {totalThisMonth === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm font-medium text-ink-400">No stories this month.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={`${d}-${i}`} className="text-center text-[10px] font-bold uppercase tracking-widest text-ink-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;
              const key = `${year}-${month}-${day}`;
              const count = countsByDay[key] || 0;
              const dateLabel = new Date(year, month, day).toLocaleDateString('default', {
                month: 'short',
                day: 'numeric',
              });
              return (
                <div
                  key={key}
                  className="relative aspect-square"
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div
                    className={`w-full h-full rounded-sm flex items-center justify-center text-[11px] font-bold ${intensityClass(count)} ${count > 3 ? 'text-white' : 'text-ink-600'} transition-colors cursor-default`}
                  >
                    {day}
                  </div>
                  {hovered === key && count > 0 && (
                    <div className="absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap bg-ink text-white text-[11px] font-medium px-2.5 py-1.5 rounded-sm shadow-xl">
                      {count} {count === 1 ? 'story' : 'stories'} on {dateLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-center gap-3 mt-6 pt-6 border-t border-wire flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Less</span>
        {[0, 1, 2, 4, 6].map((c) => (
          <div key={c} className={`w-4 h-4 rounded-sm ${intensityClass(c)}`} />
        ))}
        <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">More</span>
      </div>
    </div>
  );
}
