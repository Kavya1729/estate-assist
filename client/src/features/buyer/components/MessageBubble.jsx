import { RotateCw, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

import { useLanguage } from '../language';

/**
 * One chat message. Buyer messages sit on the right; the assistant and staff
 * on the left (staff replies are marked so the buyer knows a person wrote them).
 * `pending` is a buyer message still sending or failed, with retry.
 */
export function MessageBubble({ message, pending, onRetry, onDiscard }) {
  const { t, language } = useLanguage();
  const mine = message.role === 'buyer';
  const failed = pending?.status === 'failed';

  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {message.role === 'staff' && (
        <span className="px-1 text-[11px] font-medium text-muted-foreground">{t.salesTeam}</span>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words sm:max-w-[75%]',
          mine
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border bg-card',
          message.role === 'staff' && 'border-accent bg-accent/60',
          pending?.status === 'sending' && 'opacity-70',
          failed && 'bg-primary/60',
        )}
      >
        {message.text}
      </div>
      {failed ? (
        <div className="flex items-center gap-1 px-1 text-xs text-destructive" role="alert">
          <span>
            {t.notSent} {pending.error}
          </span>
          <Button variant="ghost" size="xs" onClick={onRetry}>
            <RotateCw /> {t.retry}
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label={t.discard} onClick={onDiscard}>
            <X />
          </Button>
        </div>
      ) : (
        message.createdAt && (
          <time dateTime={message.createdAt} className="px-1 text-[11px] text-muted-foreground">
            {formatTime(message.createdAt, language)}
          </time>
        )
      )}
    </div>
  );
}
