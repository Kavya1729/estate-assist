import { useState } from 'react';
import { Bot, Hourglass, Loader2, MessagesSquare, UserRound } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { handBackChat, takeOverChat } from '../api';
import { useAction } from '../hooks/useAction';
import { SOURCES } from '../labels';
import { leadName } from '../leadFormat';
import { ChatHistory } from './ChatHistory';
import { InlineError } from './Section';
import { StaffReplyBox } from './StaffReplyBox';

const CHANNELS = { web: 'Web chat', whatsapp: 'WhatsApp' };

/** `ai`: the assistant replies. `human` without an owner: handed off, nobody has picked it up yet. */
function chatState(conversation) {
  if (conversation.mode === 'ai') return 'assistant';
  return conversation.takenOverBy ? 'staff' : 'waiting';
}

const STATE_PILLS = {
  assistant: { icon: Bot, className: 'bg-secondary text-secondary-foreground' },
  staff: { icon: UserRound, className: 'bg-primary/10 text-primary' },
  waiting: { icon: Hourglass, className: 'bg-rose-50 text-rose-700' },
};

function ModeControl({ leadId, conversation, onChanged }) {
  const { pending, error, run } = useAction(onChanged);
  const state = chatState(conversation);
  const { icon: Icon, className } = STATE_PILLS[state];
  const label = {
    assistant: 'Assistant is replying',
    staff: `${conversation.takenOverBy?.name} is handling it`,
    waiting: 'Waiting for a person',
  }[state];

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            className,
          )}
        >
          <Icon className="size-3.5" aria-hidden /> {label}
        </span>
        {state !== 'staff' && (
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(pending)}
            onClick={() => run('takeover', () => takeOverChat(leadId))}
          >
            {pending === 'takeover' && <Loader2 className="animate-spin" />} Take over
          </Button>
        )}
        {state !== 'assistant' && (
          <Button
            variant={state === 'staff' ? 'outline' : 'ghost'}
            size="sm"
            disabled={Boolean(pending)}
            onClick={() => run('handback', () => handBackChat(leadId))}
          >
            {pending === 'handback' && <Loader2 className="animate-spin" />} Hand back to assistant
          </Button>
        )}
      </div>
      <InlineError>{error}</InlineError>
    </div>
  );
}

export function ConversationPanel({ lead, conversations, onChanged }) {
  const [channel, setChannel] = useState(conversations[0]?.channel);
  const conversation = conversations.find((c) => c.channel === channel) ?? conversations[0];

  if (!conversation) {
    return (
      <section className="rounded-xl border bg-card">
        <header className="border-b px-4 py-3 sm:px-5">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal">
            <MessagesSquare className="size-4 text-muted-foreground" aria-hidden /> Conversation
          </h2>
        </header>
        <div className="p-4 sm:p-5">
          <EmptyState
            icon={MessagesSquare}
            title="No chat yet"
            message={`This lead came from ${SOURCES[lead.primarySource]?.label.toLowerCase() ?? 'a lead source'} and has not messaged the assistant. Call them on the number above.`}
          />
        </div>
      </section>
    );
  }

  const disabledReason = lead.optedOut
    ? 'This buyer opted out of messages. Do not contact them.'
    : null;

  return (
    <section className="flex flex-col rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold tracking-normal">
            <MessagesSquare className="size-4 text-muted-foreground" aria-hidden /> Conversation
          </h2>
          {conversations.length > 1 ? (
            <div className="flex gap-1" role="group" aria-label="Channel">
              {conversations.map((c) => (
                <button
                  key={c.channel}
                  type="button"
                  aria-pressed={c.channel === conversation.channel}
                  onClick={() => setChannel(c.channel)}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs',
                    c.channel === conversation.channel
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {CHANNELS[c.channel]}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {CHANNELS[conversation.channel]} · {conversation.messages.length} messages
            </p>
          )}
        </div>
        <ModeControl leadId={lead.id} conversation={conversation} onChanged={onChanged} />
      </header>

      {conversation.messages.length ? (
        <ChatHistory messages={conversation.messages} buyerName={leadName(lead)} />
      ) : (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">No messages yet.</p>
      )}

      <StaffReplyBox
        leadId={lead.id}
        takesOver={chatState(conversation) !== 'staff'}
        disabledReason={disabledReason}
        onSent={onChanged}
      />
    </section>
  );
}
