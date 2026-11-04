import { useState } from 'react';
import { Copy, GitMerge, Loader2 } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { formatDayMonth } from '@/lib/format';

import { resolveDuplicate } from '../api';
import { useAction } from '../hooks/useAction';
import { DUPLICATE_REASONS } from '../labels';
import { leadName } from '../leadFormat';
import { SourceTag } from './LeadBadges';
import { InlineError, Section } from './Section';

const RESOLVED = { merged: 'Merged into this lead', ignored: 'Marked as not a duplicate' };

function OpenFlag({ leadId, flag, onChanged }) {
  const { pending, error, run } = useAction(onChanged);
  const [confirmMerge, setConfirmMerge] = useState(false);
  const other = flag.lead;

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/staff/leads/${other.id}`} className="font-medium hover:underline">
            {leadName(other)}
          </Link>
          <p className="text-xs text-muted-foreground">
            {other.code} · {other.phone ?? 'No phone'} · {formatDayMonth(other.createdAt)}
          </p>
        </div>
        <SourceTag source={other.primarySource} />
      </div>
      <p className="text-xs text-violet-800">{DUPLICATE_REASONS[flag.reason] ?? flag.reason}</p>
      {confirmMerge ? (
        <div className="space-y-2 rounded-lg bg-muted/50 p-2.5 text-sm">
          <p>
            Merge {leadName(other)} into this lead? Their sources, chat and visit move here and the
            other record leaves the list.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={Boolean(pending)}
              onClick={() => run('merge', () => resolveDuplicate(leadId, other.id, 'merged'))}
            >
              {pending === 'merge' && <Loader2 className="animate-spin" />} Yes, merge
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmMerge(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(pending)}
            onClick={() => setConfirmMerge(true)}
          >
            <GitMerge /> Merge into this lead
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(pending)}
            onClick={() => run('ignore', () => resolveDuplicate(leadId, other.id, 'ignored'))}
          >
            {pending === 'ignore' && <Loader2 className="animate-spin" />} Not a duplicate
          </Button>
        </div>
      )}
      <InlineError>{error}</InlineError>
    </li>
  );
}

/** Only shown when the lead was flagged as a possible duplicate of another one. */
export function DuplicatesCard({ lead, onChanged }) {
  const flags = lead.possibleDuplicates.filter((flag) => flag.lead);
  if (!flags.length) return null;
  const open = flags.filter((flag) => flag.resolution === 'open');
  const resolved = flags.filter((flag) => flag.resolution !== 'open');

  return (
    <Section
      title="Possible duplicates"
      icon={Copy}
      description="Same buyer from another source? Merge them so only one person calls."
    >
      {open.length > 0 && (
        <ul className="divide-y">
          {open.map((flag) => (
            <OpenFlag key={flag.lead.id} leadId={lead.id} flag={flag} onChanged={onChanged} />
          ))}
        </ul>
      )}
      {resolved.length > 0 && (
        <ul className={open.length ? 'mt-3 space-y-1 border-t pt-3' : 'space-y-1'}>
          {resolved.map((flag) => (
            <li key={flag.lead.id} className="text-xs text-muted-foreground">
              {leadName(flag.lead)} ({flag.lead.code}): {RESOLVED[flag.resolution]}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
