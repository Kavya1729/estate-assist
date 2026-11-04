import { ArrowLeft, Headset, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';

import { useLanguage } from '../language';
import { LanguageSwitcher } from './LanguageSwitcher';

/** "Talk to a person" stays in the header for the whole chat; once a person has it, it says so. */
export function ChatHeader({ title, subtitle, withPerson, onTalkToPerson, disabled }) {
  const { t } = useLanguage();

  return (
    <header className="border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <Button asChild variant="ghost" size="icon" aria-label={t.home}>
          <Link to="/">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base leading-tight">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <LanguageSwitcher className="hidden sm:inline-flex" />
        {withPerson ? (
          <span
            role="status"
            aria-label={t.withPerson}
            title={t.withPerson}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium"
          >
            <UserRoundCheck className="size-3.5" aria-hidden />
            <span className="hidden min-[400px]:inline">{t.withPerson}</span>
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onTalkToPerson}
            disabled={disabled}
            aria-label={t.talkToPerson}
          >
            <Headset /> <span className="hidden min-[400px]:inline">{t.talkToPerson}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
