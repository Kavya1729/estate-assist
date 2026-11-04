import { useState } from 'react';
import { CalendarDays, SendHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

import { useLanguage } from '../language';

const MAX_LENGTH = 1000;

/** Message box: Enter sends, Shift+Enter adds a line. The calendar opens the slot picker. */
export function Composer({ onSend, onPickSlot, busy, disabled }) {
  const { t } = useLanguage();
  const [text, setText] = useState('');

  function submit(event) {
    event?.preventDefault();
    if (!text.trim() || busy || disabled) return;
    onSend(text);
    setText('');
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0 rounded-full"
        onClick={onPickSlot}
        disabled={disabled}
        aria-label={t.bookVisit}
        title={t.bookVisit}
      >
        <CalendarDays />
      </Button>
      <Textarea
        rows={1}
        value={text}
        maxLength={MAX_LENGTH}
        placeholder={t.messagePlaceholder}
        aria-label={t.messagePlaceholder}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
        }}
        className="max-h-36 min-h-10 resize-none rounded-2xl bg-card px-4 py-2.5"
      />
      <Button
        type="submit"
        size="icon-lg"
        className="shrink-0 rounded-full"
        disabled={!text.trim() || busy || disabled}
        aria-label={t.send}
      >
        <SendHorizontal />
      </Button>
    </form>
  );
}
