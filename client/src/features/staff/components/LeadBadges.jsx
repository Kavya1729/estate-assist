import { Copy, Flame, MessageCircleWarning, Snowflake, Sun } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { SOURCES, STATUSES, TEMPERATURES } from '../labels';

const TEMPERATURE_ICONS = { hot: Flame, warm: Sun, cold: Snowflake };

export function TemperatureBadge({ temperature, score, className }) {
  const meta = TEMPERATURES[temperature] ?? TEMPERATURES.cold;
  const Icon = TEMPERATURE_ICONS[temperature] ?? Snowflake;
  return (
    <Badge
      variant="outline"
      className={cn(meta.className, className)}
      title={score != null ? `Score ${score} of 100` : undefined}
    >
      <Icon aria-hidden /> {meta.label}
      {score != null && <span className="font-normal opacity-70">· {score}</span>}
    </Badge>
  );
}

export function StatusBadge({ status, labels = STATUSES, className }) {
  const meta = labels[status] ?? { label: status, className: '' };
  return <Badge className={cn(meta.className, className)}>{meta.label}</Badge>;
}

export function SourceTag({ source, short = true, className }) {
  const meta = SOURCES[source];
  if (!meta) return null;
  return (
    <Badge variant="outline" className={cn('bg-card font-normal', className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {short ? meta.short : meta.label}
    </Badge>
  );
}

/** The first tag is the source the lead is attributed to. */
export function SourceTags({ sources, className }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {sources.map((source, index) => (
        <SourceTag
          key={source}
          source={source}
          className={index === 0 ? 'border-foreground/25' : undefined}
        />
      ))}
    </div>
  );
}

export function DuplicateBadge({ count, className }) {
  if (!count) return null;
  return (
    <Badge
      variant="outline"
      className={cn('border-violet-200 bg-violet-50 text-violet-800', className)}
      title="Possible duplicate: check before calling"
    >
      <Copy aria-hidden /> {count > 1 ? `${count} duplicates` : 'Duplicate?'}
    </Badge>
  );
}

export function HandoffBadge({ className }) {
  return (
    <Badge
      variant="outline"
      className={cn('border-rose-200 bg-rose-50 text-rose-700', className)}
      title="The assistant handed this chat to the team"
    >
      <MessageCircleWarning aria-hidden /> Needs reply
    </Badge>
  );
}
