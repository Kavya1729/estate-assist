import { Headset } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { Button } from '@/components/ui/button';

import { useLanguage } from '../language';
import { useBuyerToken } from '../session';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ReraFooter } from './ReraFooter';

/**
 * Header, page and RERA footer shared by the landing, visit and 404 pages.
 * "Talk to a person" is on every buyer screen: with a chat it asks for a person
 * there; without one it goes to the start form (the landing page passes its own handler).
 */
export function BuyerShell({ children, projectCode, onTalkToPerson }) {
  const { t } = useLanguage();
  const token = useBuyerToken();
  const navigate = useNavigate();

  function talkToPerson() {
    if (token) navigate('/chat', { state: { intent: 'person' } });
    else if (onTalkToPerson) onTalkToPerson();
    else navigate('/', { state: { intent: 'person' } });
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link to="/" className="font-serif text-lg tracking-tight">
          {t.brand}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Button variant="outline" size="sm" onClick={talkToPerson} aria-label={t.talkToPerson}>
            <Headset /> <span className="hidden min-[400px]:inline">{t.talkToPerson}</span>
          </Button>
        </div>
      </header>
      <LanguageSwitcher className="mx-5 mb-2 self-start sm:hidden" />
      <main className="flex-1">{children}</main>
      <ReraFooter projectCode={projectCode} />
    </div>
  );
}
