import { useEffect, useState } from 'react';
import { Copy, MessageCircleWarning, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';

import { PROJECTS, SOURCE_KEYS, SOURCES, STATUSES, TEMPERATURES } from '../labels';

const SEARCH_DELAY_MS = 300;

function SearchBox({ value, onChange }) {
  const [text, setText] = useState(value);

  useEffect(() => {
    if (text.trim() === value) return undefined;
    const timer = setTimeout(() => onChange(text.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, value, onChange]);

  return (
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Name, phone or lead code"
        aria-label="Search leads"
        className="bg-card pl-9"
      />
    </div>
  );
}

function Toggle({ pressed, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {children}
    </button>
  );
}

/**
 * Search, the quick Hot/Warm/Cold and "needs reply" chips, and dropdowns for
 * the rest. `resetKey` remounts the search box when the filters are cleared.
 */
export function LeadFilters({
  filters,
  sort,
  activeCount,
  onChange,
  onClear,
  resetKey,
  executives,
}) {
  const set = (key) => (event) => onChange({ [key]: event.target.value });
  const toggle = (key, value) => onChange({ [key]: filters[key] === value ? '' : value });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 min-[480px]:flex-row">
        <SearchBox
          key={resetKey}
          value={filters.q}
          onChange={(q) => onChange({ q }, { replace: true })}
        />
        <NativeSelect
          value={sort}
          onChange={(e) => onChange({ sort: e.target.value === 'recent' ? '' : e.target.value })}
          aria-label="Sort leads"
          className="shrink-0 min-[480px]:w-44"
        >
          <option value="recent">Latest activity</option>
          <option value="score">Highest score</option>
          <option value="created">Newest first</option>
        </NativeSelect>
      </div>

      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Quick filters"
      >
        {Object.entries(TEMPERATURES).map(([value, meta]) => (
          <Toggle
            key={value}
            pressed={filters.temperature === value}
            onClick={() => toggle('temperature', value)}
          >
            {meta.label}
          </Toggle>
        ))}
        <span className="mx-1 w-px shrink-0 bg-border" aria-hidden />
        <Toggle
          pressed={filters.handoff === 'pending'}
          onClick={() => toggle('handoff', 'pending')}
          icon={MessageCircleWarning}
        >
          Needs reply
        </Toggle>
        <Toggle
          pressed={filters.duplicates === 'open'}
          onClick={() => toggle('duplicates', 'open')}
          icon={Copy}
        >
          Duplicates
        </Toggle>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <NativeSelect
          value={filters.source}
          onChange={set('source')}
          aria-label="Source"
          className="sm:w-44"
        >
          <option value="">All sources</option>
          {SOURCE_KEYS.map((key) => (
            <option key={key} value={key}>
              {SOURCES[key].label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={filters.status}
          onChange={set('status')}
          aria-label="Status"
          className="sm:w-40"
        >
          <option value="">All statuses</option>
          {Object.entries(STATUSES).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={filters.projectCode}
          onChange={set('projectCode')}
          aria-label="Project"
          className="sm:w-36"
        >
          <option value="">All projects</option>
          {PROJECTS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </NativeSelect>
        {executives && (
          <NativeSelect
            value={filters.assignedTo}
            onChange={set('assignedTo')}
            aria-label="Owner"
            className="sm:w-44"
          >
            <option value="">Everyone</option>
            <option value="unassigned">Unassigned</option>
            {executives.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="justify-self-start">
            <X /> Clear filters ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}
