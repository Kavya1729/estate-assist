import { MessageSquareText, Send } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { formatDateTime } from '@/lib/format';

import { OUTBOX_STATUSES, OUTBOX_TEMPLATES } from '../labels';
import { StatusBadge } from './LeadBadges';
import { Section } from './Section';

/** Confirmations and reminders. WhatsApp sending is simulated, so these are the outbox rows. */
export function OutboxCard({ messages }) {
  return (
    <Section
      title="WhatsApp outbox"
      icon={Send}
      description="Confirmations and reminders sent to the buyer"
    >
      {messages.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title="Nothing sent yet"
          message="A confirmation goes out when a visit is booked, then reminders a day and 2 hours before."
          className="py-6"
        />
      ) : (
        <ul className="divide-y">
          {messages.map((message) => (
            <li key={message.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {OUTBOX_TEMPLATES[message.template] ?? message.template}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(message.sentAt ?? message.createdAt)}
                  </p>
                </div>
                <StatusBadge status={message.status} labels={OUTBOX_STATUSES} />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                {message.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
