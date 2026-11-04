import { Fragment, useEffect, useRef } from 'react';
import { Bot, ShieldAlert, Wrench } from 'lucide-react';

import { formatLongDay, formatTime, istDateKey } from '@/lib/format';
import { cn } from '@/lib/utils';

const ROLE_LABELS = { assistant: 'Assistant', staff: 'Sales team' };
const MAX_RESULT_CHARS = 600;

function preview(value) {
  const text = JSON.stringify(value, null, 1) ?? '';
  return text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…` : text;
}

function ToolCalls({ calls }) {
  return (
    <details className="group w-full max-w-[85%] text-xs text-muted-foreground sm:max-w-[75%]">
      <summary className="inline-flex items-center gap-1 rounded px-1 hover:text-foreground">
        <Wrench className="size-3" aria-hidden />
        {calls.map((c) => c.name).join(', ')}
      </summary>
      <div className="mt-1 space-y-2 rounded-lg border bg-muted/40 p-2">
        {calls.map((call, index) => (
          <div key={index} className="space-y-1">
            <p className="font-medium text-foreground">
              {call.name}{' '}
              <span className={call.ok ? 'text-emerald-700' : 'text-destructive'}>
                {call.ok ? 'ok' : 'failed'}
              </span>
            </p>
            <pre className="overflow-x-auto font-mono text-[11px] whitespace-pre-wrap [overflow-wrap:anywhere]">
              {preview(call.args)}
            </pre>
            {call.result !== undefined && (
              <pre className="max-h-40 overflow-auto font-mono text-[11px] whitespace-pre-wrap opacity-80 [overflow-wrap:anywhere]">
                → {preview(call.result)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

function Message({ message, buyerName }) {
  if (message.role === 'system') {
    return (
      <p className="mx-auto max-w-[90%] rounded-full bg-muted px-3 py-1 text-center text-xs text-muted-foreground">
        {message.text} · {formatTime(message.createdAt)}
      </p>
    );
  }

  const fromBuyer = message.role === 'buyer';
  const label = fromBuyer
    ? buyerName
    : message.role === 'staff'
      ? (message.author?.name ?? ROLE_LABELS.staff)
      : ROLE_LABELS.assistant;

  return (
    <div className={cn('flex flex-col gap-1', fromBuyer ? 'items-start' : 'items-end')}>
      <span className="flex items-center gap-1 px-1 text-[11px] font-medium text-muted-foreground">
        {message.role === 'assistant' && <Bot className="size-3" aria-hidden />}
        {label}
      </span>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words sm:max-w-[75%]',
          fromBuyer && 'rounded-bl-md border bg-card',
          message.role === 'assistant' && 'rounded-br-md bg-secondary',
          message.role === 'staff' && 'rounded-br-md bg-primary text-primary-foreground',
          message.flagged && 'ring-2 ring-rose-300',
        )}
      >
        {message.text}
      </div>
      {message.flagged && (
        <div className="max-w-[85%] space-y-1 text-right text-xs text-rose-700 sm:max-w-[75%]">
          <p className="inline-flex items-center gap-1">
            <ShieldAlert className="size-3.5" aria-hidden />
            Guardrail replaced the reply{message.flagReason && `: ${message.flagReason}`}
          </p>
          {message.blockedText && (
            <details className="text-left text-muted-foreground">
              <summary className="text-right">Show the blocked draft</summary>
              <p className="mt-1 rounded-lg border border-dashed p-2 whitespace-pre-wrap">
                {message.blockedText}
              </p>
            </details>
          )}
        </div>
      )}
      {message.toolCalls?.length > 0 && <ToolCalls calls={message.toolCalls} />}
      <time dateTime={message.createdAt} className="px-1 text-[11px] text-muted-foreground">
        {formatTime(message.createdAt)}
      </time>
    </div>
  );
}

/** The full chat as staff see it: system notes, tool calls and guardrail flags included. */
export function ChatHistory({ messages, buyerName }) {
  const scroller = useRef(null);
  const count = messages.length;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div
      ref={scroller}
      className="max-h-[60svh] min-h-48 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
      aria-label="Chat history"
      tabIndex={0}
    >
      {messages.map((message, index) => {
        const day = istDateKey(message.createdAt);
        const newDay = index === 0 || istDateKey(messages[index - 1].createdAt) !== day;
        return (
          <Fragment key={message.id ?? index}>
            {newDay && (
              <p className="text-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {formatLongDay(message.createdAt)}
              </p>
            )}
            <Message message={message} buyerName={buyerName} />
          </Fragment>
        );
      })}
    </div>
  );
}
