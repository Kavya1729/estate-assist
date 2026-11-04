import { BellOff, Loader2, Mail, MessageCircleWarning, Phone, UserRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { formatRelative } from '@/lib/format';

import { assignLead, takeOverChat } from '../api';
import { useAction } from '../hooks/useAction';
import { HANDOFF_REASONS } from '../labels';
import { leadName } from '../leadFormat';
import { InlineError } from './Section';
import { DuplicateBadge, SourceTags, StatusBadge, TemperatureBadge } from './LeadBadges';

function distinctSources(lead) {
  return [lead.primarySource, ...lead.sources.map((s) => s.source)].filter(
    (source, index, all) => all.indexOf(source) === index,
  );
}

function OwnerControl({ lead, executives, onChanged }) {
  const { pending, error, run } = useAction(onChanged);

  if (!executives) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <UserRound className="size-4" aria-hidden /> {lead.assignedTo?.name ?? 'Unassigned'}
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label htmlFor="lead-owner" className="text-sm text-muted-foreground">
          Owner
        </label>
        <NativeSelect
          id="lead-owner"
          value={lead.assignedTo?.id ?? ''}
          disabled={Boolean(pending)}
          onChange={(e) => run('assign', () => assignLead(lead.id, e.target.value))}
          className="w-48"
        >
          {!lead.assignedTo && <option value="">Unassigned</option>}
          {executives.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.openLeads} open
            </option>
          ))}
        </NativeSelect>
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      <InlineError>{error}</InlineError>
    </div>
  );
}

export function LeadHeader({ lead, executives, now, onChanged }) {
  const openDuplicates = lead.possibleDuplicates.filter((d) => d.resolution === 'open').length;

  return (
    <header className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl break-words sm:text-3xl">{leadName(lead)}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <TemperatureBadge temperature={lead.temperature} score={lead.score} />
            <StatusBadge status={lead.status} />
            <DuplicateBadge count={openDuplicates} />
            {lead.optedOut && (
              <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                <BellOff aria-hidden /> Opted out
              </Badge>
            )}
          </div>
        </div>
        <OwnerControl lead={lead} executives={executives} onChanged={onChanged} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex items-center gap-1.5 hover:underline"
          >
            <Phone className="size-4 text-muted-foreground" aria-hidden /> {lead.phone}
          </a>
        )}
        {lead.email && (
          <a
            href={`mailto:${lead.email}`}
            className="inline-flex min-w-0 items-center gap-1.5 break-all hover:underline"
          >
            <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden /> {lead.email}
          </a>
        )}
        <span className="text-muted-foreground">
          {lead.code} · came in {formatRelative(lead.firstInboundAt ?? lead.createdAt, now)}
        </span>
      </div>

      <SourceTags sources={distinctSources(lead)} />
    </header>
  );
}

/** Shown until someone takes the chat over after the assistant handed it to the team. */
export function HandoffBanner({ lead, canTakeOver, now, onChanged }) {
  const { pending, error, run } = useAction(onChanged);
  const handoff = lead.handoff;
  if (!handoff?.at || handoff.acknowledgedAt) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <MessageCircleWarning className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="space-y-0.5">
          <p className="font-medium">
            The assistant handed this chat to the team {formatRelative(handoff.at, now)}
          </p>
          <p className="text-sm text-rose-800">
            {HANDOFF_REASONS[handoff.reason] ?? 'Needs a person'}. Reply below or take the chat
            over.
          </p>
          <InlineError>{error}</InlineError>
        </div>
      </div>
      {canTakeOver && (
        <Button
          size="sm"
          className="shrink-0"
          disabled={Boolean(pending)}
          onClick={() => run('takeover', () => takeOverChat(lead.id))}
        >
          {pending && <Loader2 className="animate-spin" />} Take over chat
        </Button>
      )}
    </div>
  );
}
