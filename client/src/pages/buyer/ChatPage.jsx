import { useEffect, useRef, useState } from 'react';
import { BellOff, UserRoundCheck } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChatHeader } from '@/features/buyer/components/ChatHeader';
import { Composer } from '@/features/buyer/components/Composer';
import { LanguageSwitcher } from '@/features/buyer/components/LanguageSwitcher';
import { MessageBubble } from '@/features/buyer/components/MessageBubble';
import { ReraFooter } from '@/features/buyer/components/ReraFooter';
import { SlotPicker } from '@/features/buyer/components/SlotPicker';
import { TypingIndicator } from '@/features/buyer/components/TypingIndicator';
import { VisitCard } from '@/features/buyer/components/VisitCard';
import { useCatalog } from '@/features/buyer/hooks/useCatalog';
import { useChat } from '@/features/buyer/hooks/useChat';
import { useLanguage } from '@/features/buyer/language';
import { useBuyerToken } from '@/features/buyer/session';

function ChatSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-16 w-3/4 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      <Skeleton className="h-20 w-2/3 rounded-2xl" />
    </div>
  );
}

export function ChatPage() {
  const { t } = useLanguage();
  const token = useBuyerToken();
  const location = useLocation();
  const navigate = useNavigate();
  const chat = useChat(token);
  const { projects } = useCatalog();
  const endRef = useRef(null);

  // Arriving from a project card: "book" opens the picker, "person" asks for a human. Once only.
  const [arrival] = useState(() => location.state ?? {});
  const handledRef = useRef(false);
  const { status, openPicker, send } = chat;
  useEffect(() => {
    if (status !== 'ready' || handledRef.current) return;
    handledRef.current = true;
    if (arrival.intent === 'book') openPicker();
    if (arrival.intent === 'person') send(t.talkToPersonText);
    if (arrival.intent) navigate(location.pathname, { replace: true, state: null });
  }, [status, arrival, openPicker, send, t, navigate, location.pathname]);

  const messageCount = chat.messages.length + chat.outbox.length;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messageCount, chat.awaitingReply, chat.pickerOpen, chat.bookedVisit]);

  if (chat.status === 'expired') {
    return (
      <div className="flex min-h-svh items-center justify-center px-5">
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-lg">{t.sessionEnded}</p>
          <Button asChild size="lg">
            <Link to="/">{t.startChat}</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!token) return <Navigate to="/" replace />;

  const projectCode = chat.buyer?.projectCode;
  const project = projects.find((p) => p.code === projectCode);
  const withPerson = chat.mode === 'human';
  const ready = chat.status === 'ready';

  return (
    <div className="flex h-svh flex-col">
      <ChatHeader
        title={project?.name ?? t.brand}
        subtitle={chat.buyer?.name}
        withPerson={withPerson}
        disabled={!ready || chat.awaitingReply}
        onTalkToPerson={() => chat.send(t.talkToPersonText)}
      />

      <main className="flex-1 overflow-y-auto">
        <div
          className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6"
          role="log"
          aria-live="polite"
          aria-busy={chat.status === 'loading'}
        >
          {chat.status === 'loading' && <ChatSkeleton />}
          {chat.status === 'error' && (
            <ErrorState
              title={t.loadChatFailed}
              message={chat.error?.message}
              onRetry={chat.reload}
              retryLabel={t.retry}
            />
          )}

          {chat.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {chat.bookedVisit && !chat.pickerOpen && <VisitCard visit={chat.bookedVisit} />}
          {chat.outbox.map((item) => (
            <MessageBubble
              key={item.localId}
              message={{ role: 'buyer', text: item.text }}
              pending={item}
              onRetry={() => chat.retry(item.localId)}
              onDiscard={() => chat.discard(item.localId)}
            />
          ))}
          {chat.awaitingReply && !withPerson && <TypingIndicator />}

          {chat.pickerOpen && token && (
            <SlotPicker
              token={token}
              projectCode={arrival.projectCode ?? projectCode ?? null}
              projects={projects}
              onBooked={chat.onVisitBooked}
              onClose={chat.closePicker}
            />
          )}
          <div ref={endRef} />
        </div>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto max-w-2xl space-y-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {withPerson && ready && !chat.buyer?.optedOut && (
            <p className="flex items-start gap-2 rounded-xl bg-accent/50 px-4 py-2.5 text-xs leading-relaxed sm:text-sm">
              <UserRoundCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t.humanNote}
            </p>
          )}
          {chat.buyer?.optedOut && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <BellOff className="size-4 shrink-0" aria-hidden /> {t.optedOut}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={chat.awaitingReply}
                onClick={() => chat.send(t.resumeText)}
              >
                {t.resume}
              </Button>
            </div>
          )}
          <Composer
            onSend={chat.send}
            onPickSlot={chat.openPicker}
            busy={chat.awaitingReply}
            disabled={!ready}
          />
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <LanguageSwitcher className="sm:hidden" />
            <ReraFooter compact projectCode={projectCode} />
            {ready && !chat.buyer?.optedOut && (
              <button
                type="button"
                onClick={() => chat.send(t.stopText)}
                disabled={chat.awaitingReply}
                className="cursor-pointer text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                {t.stopMessages}
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
