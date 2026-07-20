'use client';

export default function FilterBar({ filter, onFilterChange, filters, filterLabels }) {
  return (
    <div className="max-w-6xl mx-auto px-5 pt-4 pb-6">
      <div className="flex items-end border-b-2 border-wire/60">
        {/* DON'T MISS Badge */}
        <div className="bg-[#FFC107] text-ink font-bold uppercase text-xs px-4 py-2 shrink-0">
          Don't Miss
        </div>
        
        {/* Tabs */}
        <div className="flex flex-wrap gap-4 text-[13px] ml-6 mb-[1px]" role="tablist" aria-label="Filter stories">
          {filters.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(f)}
                className={`pb-2 transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none ${
                  active
                    ? 'text-ink font-bold'
                    : 'text-ink-400 hover:text-ink-700'
                }`}
              >
                {filterLabels[f] || f}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}