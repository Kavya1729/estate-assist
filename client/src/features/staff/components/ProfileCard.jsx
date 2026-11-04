import { ClipboardList } from 'lucide-react';

import { formatDateTime, formatDuration } from '@/lib/format';

import { LANGUAGE_NAMES, TIMELINES } from '../labels';
import { budgetLabel } from '../leadFormat';
import { SourceTag } from './LeadBadges';
import { Section } from './Section';

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function responseTime(lead) {
  if (!lead.firstResponseAt || !lead.firstInboundAt) return 'Not answered yet';
  const seconds = (new Date(lead.firstResponseAt) - new Date(lead.firstInboundAt)) / 1000;
  return formatDuration(Math.max(0, seconds));
}

/** What we know about the buyer, why the score is what it is, and every source touch. */
export function ProfileCard({ lead }) {
  const { profile = {} } = lead;

  return (
    <Section title="Lead profile" icon={ClipboardList}>
      <dl className="divide-y">
        <Row label="Project">{lead.project?.name ?? 'Not chosen'}</Row>
        <Row label="Home">{profile.bhk ? `${profile.bhk} BHK` : 'Not shared'}</Row>
        <Row label="Budget">{budgetLabel(profile) ?? 'Not shared'}</Row>
        <Row label="Buying">{TIMELINES[profile.timeline] ?? TIMELINES.unknown}</Row>
        <Row label="Language">{LANGUAGE_NAMES[lead.language] ?? lead.language}</Row>
        <Row label="First response">{responseTime(lead)}</Row>
        <Row label="Consent">
          {lead.consent?.given
            ? `Given ${lead.consent.at ? formatDateTime(lead.consent.at) : ''}`
            : 'Not given'}
        </Row>
        {profile.notes && <Row label="Notes">{profile.notes}</Row>}
      </dl>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Score</span>
          <span className="tabular-nums">{lead.score} / 100</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-muted"
          role="meter"
          aria-label="Lead score"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={lead.score}
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${lead.score}%` }} />
        </div>
        {lead.scoreReasons.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {lead.scoreReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No scoring signals yet.</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium">Source history</p>
        <ul className="space-y-2">
          {lead.sources.map((touch, index) => (
            <li key={index} className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0 space-y-1">
                <SourceTag source={touch.source} short={false} />
                {touch.campaign && (
                  <p className="text-muted-foreground [overflow-wrap:anywhere]">{touch.campaign}</p>
                )}
              </div>
              <span className="shrink-0 text-muted-foreground">
                {formatDateTime(touch.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
