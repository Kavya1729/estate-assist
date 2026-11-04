import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { ReviewItem } from '@/features/staff/components/ReviewItem';
import { useReviews } from '@/features/staff/hooks/useQueues';
import { isSalesHead, useStaffUser } from '@/features/staff/session';
import { useNow } from '@/hooks/useNow';

function ReviewsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading review queue">
      {[0, 1].map((i) => (
        <div key={i} className="space-y-4 rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-8 w-36" />
        </div>
      ))}
    </div>
  );
}

export function ReviewsPage() {
  const head = isSalesHead(useStaffUser());
  const reviews = useReviews();
  const now = useNow();
  const [resolved, setResolved] = useState(() => new Set());

  const items = (reviews.data?.items ?? []).filter((item) => !resolved.has(item.id));
  const markResolved = (id) => setResolved((current) => new Set(current).add(id));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl">Review queue</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          When the assistant writes a price, date or number that is not on the fact sheet, the buyer
          gets a safe reply instead and the chat lands here.{' '}
          {head ? (
            <>
              If the number was right, add it to the{' '}
              <Link to="/staff/projects" className="underline underline-offset-4">
                fact sheet
              </Link>{' '}
              so the assistant can use it next time.
            </>
          ) : (
            'If the number was right, ask the sales head to add it to the fact sheet.'
          )}
        </p>
      </header>

      {reviews.status === 'loading' && <ReviewsSkeleton />}

      {reviews.status === 'error' && (
        <ErrorState
          title="Could not load the review queue"
          message={reviews.error.message}
          onRetry={reviews.reload}
        />
      )}

      {reviews.status === 'ready' &&
        (items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nothing to review"
            message="Replies stopped by the guardrails show up here, so you can check what the assistant tried to say."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              {items.length} {items.length === 1 ? 'chat' : 'chats'} to check
            </p>
            {items.map((review) => (
              <ReviewItem key={review.id} review={review} now={now} onResolved={markResolved} />
            ))}
          </div>
        ))}
    </div>
  );
}
