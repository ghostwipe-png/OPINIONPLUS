import SocialBar from './SocialBar';

export default function FilterBar({ filter, onFilterChange, filters, filterLabels }) {
  return (
    <div className="border-b border-wire bg-paper">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-wrap gap-5 text-sm" role="tablist" aria-label="Filter stories">
          {filters.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={active}
                onClick={() => onFilterChange(f)}
                className={`pb-1 border-b-2 transition-colors focus-visible:ring-2 focus-visible:ring-signal focus-visible:outline-none rounded-sm ${
                  active
                    ? 'text-ink font-semibold border-signal'
                    : 'text-ink-400 hover:text-ink-600 border-transparent'
                }`}
              >
                {filterLabels[f] || f}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:block">
          <SocialBar />
        </div>
      </div>
    </div>
  );
}
