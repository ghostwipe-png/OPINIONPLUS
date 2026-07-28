// components/SponsoredTargetingSelector.js
'use client';

import { useState } from 'react';
import { Target, ChevronDown, ChevronUp, X } from 'lucide-react';

const CATEGORIES = ['Business', 'Technology', 'Finance', 'Health', 'Real Estate', 'Education', 'Lifestyle', 'Politics', 'Sports', 'Entertainment'];
const REGIONS = ['Nairobi', 'Coast', 'Central', 'Eastern', 'Nyanza', 'Rift Valley', 'Western', 'North Eastern'];
const COUNTIES = ['Mombasa', 'Kwale', 'Kilifi', 'Tana River', 'Lamu', 'Taita Taveta', 'Garissa', 'Wajir', 'Mandera', 'Marsabit', 'Isiolo', 'Meru', 'Tharaka-Nithi', 'Embu', 'Kitui', 'Machakos', 'Makueni', 'Nyandarua', 'Nyeri', 'Kirinyaga', "Murang'a", 'Kiambu', 'Turkana', 'West Pokot', 'Samburu', 'Trans Nzoia', 'Uasin Gishu', 'Elgeyo-Marakwet', 'Nandi', 'Baringo', 'Laikipia', 'Nakuru', 'Narok', 'Kajiado', 'Kericho', 'Bomet', 'Kakamega', 'Vihiga', 'Bungoma', 'Busia', 'Siaya', 'Kisumu', 'Homa Bay', 'Migori', 'Kisii', 'Nyamira', 'Nairobi'];

export default function SponsoredTargetingSelector({ targeting, onChange }) {
  const [open, setOpen] = useState(false);
  const [countySearch, setCountySearch] = useState('');
  const [countyDropdownOpen, setCountyDropdownOpen] = useState(false);

  const categories = targeting?.categories || [];
  const regions = targeting?.regions || [];
  const counties = targeting?.counties || [];
  const totalCount = categories.length + regions.length + counties.length;

  const toggle = (list, key, value) => {
    const next = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
    onChange({ ...targeting, categories, regions, counties, [key]: next });
  };

  const removeCounty = (c) => {
    onChange({ ...targeting, counties: counties.filter(v => v !== c) });
  };

  const addCounty = (c) => {
    if (!counties.includes(c)) onChange({ ...targeting, counties: [...counties, c] });
    setCountySearch('');
  };

  const clearAll = () => onChange({ categories: [], regions: [], counties: [] });

  const filteredCounties = COUNTIES.filter(c => c.toLowerCase().includes(countySearch.toLowerCase()) && !counties.includes(c));

  const summary = totalCount === 0
    ? 'Targeting everyone'
    : [
        categories.length ? `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}` : null,
        regions.length ? `${regions.length} region${regions.length === 1 ? '' : 's'}` : null,
        counties.length ? `${counties.length} count${counties.length === 1 ? 'y' : 'ies'}` : null,
      ].filter(Boolean).join(', ');

  return (
    <div className="border border-wire rounded-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 focus-visible:ring-2 focus-visible:ring-signal"
      >
        <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
          <Target size={14} /> Targeting
          <span className="text-ink-300 normal-case">— {summary}</span>
        </span>
        {open ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5 border-t border-wire pt-4">
          <p className="text-[10px] text-ink-400 font-medium">Leave all empty to target everyone.</p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">Categories</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {CATEGORIES.map(cat => (
                <label key={cat} className="flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categories.includes(cat)}
                    onChange={() => toggle(categories, 'categories', cat)}
                    className="focus-visible:ring-2 focus-visible:ring-signal"
                  />
                  {cat}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">Regions</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {REGIONS.map(r => (
                <label key={r} className="flex items-center gap-1.5 text-xs font-medium text-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={regions.includes(r)}
                    onChange={() => toggle(regions, 'regions', r)}
                    className="focus-visible:ring-2 focus-visible:ring-signal"
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500 mb-2">Counties</p>
            {counties.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {counties.map(c => (
                  <span key={c} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-wire/20 text-ink px-2 py-1 rounded-sm">
                    {c}
                    <button type="button" onClick={() => removeCounty(c)} aria-label={`Remove ${c}`} className="hover:text-signal">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                value={countySearch}
                onChange={(e) => { setCountySearch(e.target.value); setCountyDropdownOpen(true); }}
                onFocus={() => setCountyDropdownOpen(true)}
                placeholder="Search counties..."
                className="w-full border border-wire rounded-sm px-3 py-2 text-xs bg-paper focus:outline-none focus:border-ink"
              />
              {countyDropdownOpen && countySearch && filteredCounties.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto border border-wire bg-white rounded-sm shadow-sm">
                  {filteredCounties.slice(0, 20).map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => addCounty(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-wire/10"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {totalCount > 0 && (
            <button type="button" onClick={clearAll} className="text-xs font-bold text-ink underline hover:text-signal transition-colors">
              Clear All Targeting
            </button>
          )}
        </div>
      )}
    </div>
  );
}
