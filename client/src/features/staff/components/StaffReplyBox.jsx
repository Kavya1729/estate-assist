import { useState } from 'react';
import { Loader2, SendHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { sendReply } from '../api';
import { InlineError } from './Section';

const MAX_LENGTH = 1000;

/** Ctrl/Cmd+Enter sends. The text is kept if sending fails so nothing is lost. */
export function StaffReplyBox({ leadId, takesOver, disabledReason, onSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event?.preventDefault();
    if (!text.trim() || sending || disabledReason) return;
    setSending(true);
    setError(null);
    try {
      await sendReply(leadId, text.trim());
      setText('');
      onSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (disabledReason) {
    return (
      <p className="border-t bg-muted/40 px-4 py-3 text-sm text-muted-foreground sm:px-5">
        {disabledReason}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t px-4 py-3 sm:px-5">
      <InlineError>{error}</InlineError>
      <div className="flex items-end gap-2">
        <Textarea
          rows={2}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder="Reply to the buyer…"
          aria-label="Reply to the buyer"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
          className="max-h-40 min-h-16 resize-none bg-card"
        />
        <Button
          type="submit"
          size="icon-lg"
          disabled={!text.trim() || sending}
          aria-label="Send reply"
        >
          {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {takesOver
          ? 'Sending takes the chat over: the assistant stays quiet until you hand it back.'
          : 'The buyer sees this as a message from the sales team.'}{' '}
        <span className="hidden sm:inline">Ctrl + Enter to send.</span>
      </p>
    </form>
  );
}
