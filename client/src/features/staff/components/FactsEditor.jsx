import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { MAX_FACTS } from '../factSheetForm';

const SEARCH_FROM = 8;

const matches = (fact, query) =>
  fact.isNew || `${fact.label} ${fact.value} ${fact.key}`.toLowerCase().includes(query);

function FactRow({ fact, error, onChange, onRemove }) {
  const invalid = (field) => error?.fields.includes(field) || undefined;
  return (
    <li
      className={cn(
        'grid gap-2 rounded-lg border p-3 sm:grid-cols-[14rem_minmax(0,1fr)_2.25rem]',
        error && 'border-destructive/50',
      )}
    >
      <div className="space-y-1.5">
        <Input
          aria-label="Fact label"
          placeholder="Label, e.g. Parking"
          value={fact.label}
          maxLength={80}
          autoFocus={fact.isNew && !fact.label}
          aria-invalid={invalid('label')}
          onChange={(e) => onChange(fact.uid, { label: e.target.value })}
        />
        {fact.isNew ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Key
            <input
              className="h-6 min-w-0 flex-1 rounded border bg-transparent px-1.5 font-mono text-xs aria-invalid:border-destructive"
              value={fact.key}
              aria-invalid={invalid('key')}
              maxLength={60}
              onChange={(e) => onChange(fact.uid, { key: e.target.value, keyEdited: true })}
            />
          </label>
        ) : (
          <p className="truncate font-mono text-xs text-muted-foreground" title="Fact key">
            {fact.key}
          </p>
        )}
      </div>
      <Textarea
        aria-label={`What the assistant may say about ${fact.label || 'this'}`}
        placeholder="What the assistant may say"
        rows={2}
        maxLength={1000}
        value={fact.value}
        aria-invalid={invalid('value')}
        onChange={(e) => onChange(fact.uid, { value: e.target.value })}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="justify-self-end"
        aria-label={`Remove ${fact.label || 'this fact'}`}
        onClick={() => onRemove(fact.uid)}
      >
        <Trash2 />
      </Button>
      {error && <p className="text-xs text-destructive sm:col-span-3">{error.message}</p>}
    </li>
  );
}

/** The facts the assistant answers from; anything not here is handed to a person. */
export function FactsEditor({ facts, errors, onChange, onAdd, onRemove }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle ? facts.filter((fact) => matches(fact, needle)) : facts;
  const hiddenErrors = facts.filter((fact) => errors[fact.uid] && !shown.includes(fact)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={facts.length >= MAX_FACTS}
          onClick={onAdd}
        >
          <Plus /> Add fact
        </Button>
        {facts.length >= SEARCH_FROM && (
          <div className="relative order-last w-full sm:order-none sm:w-auto sm:max-w-xs sm:flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label="Search facts"
              placeholder="Search facts"
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {needle ? `${shown.length} of ${facts.length}` : facts.length} facts
        </span>
      </div>

      {hiddenErrors > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {hiddenErrors} {hiddenErrors === 1 ? 'fact needs' : 'facts need'} fixing but the search
          hides {hiddenErrors === 1 ? 'it' : 'them'}.
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={() => setQuery('')}
          >
            Clear search
          </Button>
        </p>
      )}

      {shown.length > 0 ? (
        <ul className="space-y-2">
          {shown.map((fact) => (
            <FactRow
              key={fact.uid}
              fact={fact}
              error={errors[fact.uid]}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          {needle ? 'No fact matches that search.' : 'No facts yet.'}
        </p>
      )}
    </div>
  );
}
