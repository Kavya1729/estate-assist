import { useState } from 'react';
import { Copy } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { DuplicatePair } from '@/features/staff/components/DuplicatePair';
import { useDuplicatePairs } from '@/features/staff/hooks/useQueues';

function PairsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading possible duplicates">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-28 rounded-full" />
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="grid grid-cols-[6rem_1fr_1fr] gap-3">
              <Skeleton className="h-3" />
              <Skeleton className="h-3" />
              <Skeleton className="h-3" />
            </div>
          ))}
          <Skeleton className="h-8 w-48" />
        </div>
      ))}
    </div>
  );
}

export function DuplicatesPage() {
  const pairs = useDuplicatePairs();
  const [done, setDone] = useState(() => new Set());

  const items = (pairs.data?.items ?? []).filter((pair) => !done.has(pair.id));

  function markDone(id) {
    setDone((current) => new Set(current).add(id));
    // A merge re-points other flags at the kept lead, so the list itself changes.
    pairs.refresh();
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl">Possible duplicates</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The same phone number is merged automatically. A similar name or a shared email with a
          different phone is only flagged, because two people can share a name or a family email.
          Compare the two leads and decide.
        </p>
      </header>

      {pairs.status === 'loading' && <PairsSkeleton />}

      {pairs.status === 'error' && (
        <ErrorState
          title="Could not load possible duplicates"
          message={pairs.error.message}
          onRetry={pairs.reload}
        />
      )}

      {pairs.status === 'ready' &&
        (items.length === 0 ? (
          <EmptyState
            icon={Copy}
            title="No possible duplicates"
            message="When a new lead looks like one you already have, the pair shows up here."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              {items.length} {items.length === 1 ? 'pair' : 'pairs'} to check
            </p>
            {items.map((pair) => (
              <DuplicatePair key={pair.id} pair={pair} onDone={markDone} />
            ))}
          </div>
        ))}
    </div>
  );
}
