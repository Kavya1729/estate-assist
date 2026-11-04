import { Check, Loader2, MessageSquare, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { formatDateTime, formatRelative } from '@/lib/format';

import { resolveReview } from '../api';
import { useAction } from '../hooks/useAction';
import { leadName } from '../leadFormat';
import { InlineError } from './Section';

function FlaggedMessage({ message }) {
  return (
    <li className="space-y-2">
      <p className="flex items-start gap-1.5 text-xs text-rose-700">
        <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        <span>
          {message.flagReason ?? 'Guardrail replaced the reply'} ·{' '}
          <span className="text-muted-foreground">{formatDateTime(message.createdAt)}</span>
        </span>
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-dashed border-rose-200 bg-rose-50/60 p-3">
          <p className="text-xs font-medium text-rose-800">The assistant wrote (not sent)</p>
          <p className="mt-1 text-sm break-words whitespace-pre-wrap">
            {message.blockedText ?? 'The draft was not kept.'}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">The buyer got instead</p>
          <p className="mt-1 text-sm break-words whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    </li>
  );
}

/** One flagged chat: what the guardrail stopped, what went out, and a way to sign it off. */
export function ReviewItem({ review, now, onResolved }) {
  const { pending, error, run } = useAction(() => onResolved(review.id));
  const { lead } = review;

  return (
    <article className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          {lead ? (
            <Link
              to={`/staff/leads/${lead.id}`}
              state={{ from: '/staff/reviews' }}
              className="font-medium hover:underline"
            >
              {leadName(lead)}
            </Link>
          ) : (
            <span className="font-medium">Lead removed</span>
          )}
          <p className="text-xs text-muted-foreground">
            {lead?.code}
            {lead && ` · ${lead.assignedTo ?? 'Unassigned'}`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Last message {formatRelative(review.lastMessageAt, now)}
          {review.mode === 'human' && ' · a person is handling it'}
        </p>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <ul className="space-y-4">
          {review.flaggedMessages.map((message) => (
            <FlaggedMessage key={message.id} message={message} />
          ))}
        </ul>
        <InlineError>{error}</InlineError>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={Boolean(pending)}
            onClick={() => run('resolve', () => resolveReview(review.id))}
          >
            {pending ? <Loader2 className="animate-spin" /> : <Check />} Mark reviewed
          </Button>
          {lead && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/staff/leads/${lead.id}`} state={{ from: '/staff/reviews' }}>
                <MessageSquare /> Open chat
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
