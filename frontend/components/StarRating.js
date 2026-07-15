'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

export default function StarRating({ value = 0, onRate, readOnly = false, size = 16 }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex items-center gap-0.5" role={readOnly ? undefined : 'radiogroup'} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => !readOnly && onRate && onRate(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
        >
          <Star
            size={size}
            fill={n <= display ? '#C99A3B' : 'none'}
            stroke={n <= display ? '#C99A3B' : '#6B7180'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
