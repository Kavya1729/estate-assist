import { CalendarCheck, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { formatDay, formatTime } from '@/lib/format';

import { useLanguage } from '../language';

/** The booked visit, pinned in the chat, linking to the confirmation page. */
export function VisitCard({ visit }) {
  const { t, language } = useLanguage();

  return (
    <Link
      to="/visit"
      className="group flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <CalendarCheck className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{t.visitBooked}</span>
        <span className="block text-xs text-muted-foreground">
          {visit.project.name} · {formatDay(visit.startsAt, language)},{' '}
          {formatTime(visit.startsAt, language)}
        </span>
      </span>
      <span className="flex shrink-0 items-center text-xs font-medium text-primary">
        <span className="hidden min-[400px]:inline">{t.viewVisit}</span>
        <ChevronRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}
