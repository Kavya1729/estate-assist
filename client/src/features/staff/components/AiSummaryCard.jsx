import { Sparkles } from 'lucide-react';

import { formatDateTime } from '@/lib/format';

import { HANDOFF_REASONS, TIMELINES } from '../labels';
import { budgetLabel } from '../leadFormat';
import { Section } from './Section';

const WRITTEN_BY = {
  assistant: 'Written by the assistant at handoff',
  model: 'Summarised by the AI model at handoff',
  rules: 'Built from the chat by rules (AI summary was unavailable)',
};

function hasContent(summary) {
  return Boolean(
    summary?.needs || summary?.budget || summary?.questions?.length || summary?.concerns?.length,
  );
}

/** Until the assistant hands over, the profile it has gathered is the best summary. */
function profileSentence(lead) {
  const { bhk, timeline } = lead.profile ?? {};
  const parts = [
    bhk ? `Looking for a ${bhk} BHK` : 'Home size not shared yet',
    lead.project && `at ${lead.project.name}`,
  ].filter(Boolean);
  const budget = budgetLabel(lead.profile);
  const sentences = [`${parts.join(' ')}.`];
  if (budget) sentences.push(`Budget ${budget.charAt(0).toLowerCase()}${budget.slice(1)}.`);
  if (timeline && timeline !== 'unknown')
    sentences.push(`Plans to buy ${TIMELINES[timeline].toLowerCase()}.`);
  return sentences.join(' ');
}

function List({ title, items }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function AiSummaryCard({ lead, className }) {
  const handoff = lead.handoff;
  const summary = handoff?.summary;

  return (
    <Section
      title="AI summary"
      icon={Sparkles}
      description={
        handoff?.at
          ? `Handed over ${formatDateTime(handoff.at)}: ${HANDOFF_REASONS[handoff.reason] ?? 'needs a person'}`
          : 'What the assistant has learnt so far'
      }
      className={className}
    >
      {hasContent(summary) ? (
        <div className="space-y-3">
          {summary.needs && <p className="text-sm leading-relaxed">{summary.needs}</p>}
          {summary.budget && (
            <p className="text-sm">
              <span className="text-muted-foreground">Budget: </span>
              {summary.budget}
            </p>
          )}
          <List title="Questions asked" items={summary.questions} />
          <List title="Concerns" items={summary.concerns} />
          {summary.source && (
            <p className="text-xs text-muted-foreground">{WRITTEN_BY[summary.source]}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed">{profileSentence(lead)}</p>
          <p className="text-xs text-muted-foreground">
            From the lead profile. The assistant writes a full summary when it hands the chat to the
            team.
          </p>
        </div>
      )}
    </Section>
  );
}
