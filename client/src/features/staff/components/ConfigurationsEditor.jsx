import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRupeeRange } from '@/lib/format';
import { cn } from '@/lib/utils';

import { MAX_CONFIGURATIONS } from '../factSheetForm';

const COLUMNS =
  'grid grid-cols-2 gap-2 sm:grid-cols-[4.5rem_repeat(4,minmax(0,1fr))_5.5rem_2.25rem] sm:items-start';

const FIELDS = [
  { name: 'bhk', label: 'BHK', step: 1, min: 1, max: 6, className: 'col-span-2 sm:col-span-1' },
  { name: 'areaMin', label: 'Smallest, sq ft', step: 1, min: 0 },
  { name: 'areaMax', label: 'Largest, sq ft', step: 1, min: 0 },
  { name: 'priceMin', label: 'From, ₹ lakh', step: 0.5, min: 0 },
  { name: 'priceMax', label: 'Up to, ₹ lakh', step: 0.5, min: 0 },
  { name: 'units', label: 'Units left', step: 1, min: 0, placeholder: 'Optional' },
];

function pricePreview(c) {
  const min = Number(c.priceMin) * 100_000;
  const max = Number(c.priceMax) * 100_000;
  if (!c.priceMin || !c.priceMax || !(max >= min) || min <= 0) return null;
  return formatRupeeRange({ min, max });
}

/** BHK types with the area and price ranges the assistant may quote. */
export function ConfigurationsEditor({ rows, errors, onChange, onAdd, onRemove }) {
  return (
    <div className="space-y-3">
      <div className={cn(COLUMNS, 'hidden px-3 text-xs text-muted-foreground sm:grid')} aria-hidden>
        {FIELDS.map((field) => (
          <span key={field.name}>{field.label}</span>
        ))}
      </div>

      {rows.map((row) => {
        const error = errors[row.uid];
        const preview = pricePreview(row);
        return (
          <div
            key={row.uid}
            className={cn('space-y-2 rounded-lg border p-3', error && 'border-destructive/50')}
          >
            <div className={COLUMNS}>
              {FIELDS.map((field) => (
                <label key={field.name} className={cn('space-y-1', field.className)}>
                  <span className="text-xs text-muted-foreground sm:sr-only">{field.label}</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step={field.step}
                    min={field.min}
                    max={field.max}
                    placeholder={field.placeholder}
                    value={row[field.name]}
                    aria-invalid={error?.fields.includes(field.name) || undefined}
                    onChange={(e) => onChange(row.uid, { [field.name]: e.target.value })}
                  />
                </label>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-2 justify-self-end sm:col-span-1"
                aria-label={`Remove the ${row.bhk || 'new'} BHK row`}
                onClick={() => onRemove(row.uid)}
              >
                <Trash2 />
              </Button>
            </div>
            {(error || preview) && (
              <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
                {error?.message ?? `The assistant says: ${preview}`}
              </p>
            )}
          </div>
        );
      })}

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          No BHK types yet. Without them the assistant cannot talk about prices or sizes.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rows.length >= MAX_CONFIGURATIONS}
        onClick={onAdd}
      >
        <Plus /> Add BHK type
      </Button>
    </div>
  );
}
