import { useEffect, useState } from 'react';
import {
  BellRing,
  CalendarPlus,
  CircleCheck,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
} from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BuyerShell } from '@/features/buyer/components/BuyerShell';
import { cancelVisit, fetchVisit } from '@/features/buyer/api';
import { useLanguage } from '@/features/buyer/language';
import { clearBuyerToken, useBuyerToken } from '@/features/buyer/session';
import { useRequest } from '@/hooks/useRequest';
import { ApiError } from '@/lib/api';
import { downloadIcs } from '@/lib/calendar';
import { formatLongDay, formatTime } from '@/lib/format';

const MINUTE_MS = 60_000;

/** The pin to show: the coordinates in the project's map link, else its address. */
function mapQuery({ mapUrl, address, city }) {
  const q = mapUrl ? new URL(mapUrl).searchParams.get('q') : null;
  return q ?? `${address}, ${city}`;
}

function VisitSkeleton() {
  return (
    <div className="space-y-5" aria-busy>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
    </div>
  );
}

function Notice({ text, actionLabel, to, state }) {
  return (
    <div className="space-y-5 rounded-2xl border bg-card p-8 text-center">
      <p className="text-lg">{text}</p>
      <Button asChild size="lg">
        <Link to={to} state={state}>
          {actionLabel}
        </Link>
      </Button>
    </div>
  );
}

function VisitDetails({ visit, onCancelled }) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const token = useBuyerToken();
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const { project } = visit;
  const minutes = Math.round((new Date(visit.endsAt) - new Date(visit.startsAt)) / MINUTE_MS);
  const query = mapQuery(project);
  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
  const mapsLink = project.mapUrl ?? `https://maps.google.com/?q=${encodeURIComponent(query)}`;
  const place = `${project.address}, ${project.city}`;

  async function cancel() {
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelVisit(token);
      onCancelled();
    } catch (err) {
      setCancelError(err.message);
      setCancelling(false);
    }
  }

  function addToCalendar() {
    downloadIcs('site-visit.ics', {
      uid: `${visit.id}@estate-assist`,
      title: `Site visit · ${project.name}`,
      description: `${t.visitDuration(minutes)}. RERA ${project.reraNumber}`,
      location: place,
      startsAt: visit.startsAt,
      endsAt: visit.endsAt,
    });
  }

  return (
    <article className="space-y-8">
      <header className="space-y-4">
        <span className="inline-flex size-11 items-center justify-center rounded-full bg-success/15 text-success">
          <CircleCheck className="size-6" aria-hidden />
        </span>
        <h1 className="text-3xl leading-tight sm:text-4xl">{t.visitTitle}</h1>
      </header>

      <div className="divide-y rounded-2xl border bg-card">
        <div className="flex gap-4 p-5">
          <Clock className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-serif text-xl">{formatLongDay(visit.startsAt, language)}</p>
            <p className="mt-0.5 text-muted-foreground">
              {formatTime(visit.startsAt, language)} – {formatTime(visit.endsAt, language)} ·{' '}
              {t.visitDuration(minutes)}
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-5">
          <MapPin className="mt-1 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-serif text-xl">{project.name}</p>
            <p className="mt-0.5 text-muted-foreground">{place}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-muted">
        <iframe
          title={`${project.name} map`}
          src={embedUrl}
          className="aspect-[16/10] w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <a
          href={mapsLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 border-t bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
        >
          {t.openMaps} <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>

      <p className="flex items-start gap-3 rounded-2xl bg-accent/50 px-5 py-4 text-sm leading-relaxed">
        <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t.reminderNote}
      </p>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <Button size="lg" className="h-11" onClick={addToCalendar}>
          <CalendarPlus /> {t.addCalendar}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-11"
          onClick={() =>
            navigate('/chat', { state: { intent: 'book', projectCode: project.code } })
          }
        >
          {t.changeTime}
        </Button>
      </div>

      <div className="border-t pt-6">
        {confirming ? (
          <div
            className="flex flex-col gap-2.5 sm:flex-row"
            role="group"
            aria-label={t.cancelVisit}
          >
            <Button variant="destructive" className="h-10" onClick={cancel} disabled={cancelling}>
              {cancelling && <Loader2 className="animate-spin" />} {t.confirmCancel}
            </Button>
            <Button
              variant="ghost"
              className="h-10"
              onClick={() => setConfirming(false)}
              disabled={cancelling}
            >
              {t.keepVisit}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <Button asChild variant="link" className="px-0">
              <Link to="/chat">{t.backToChat}</Link>
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirming(true)}
            >
              {t.cancelVisit}
            </Button>
          </div>
        )}
        {cancelError && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {cancelError}
          </p>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t.rera} <span className="font-mono [overflow-wrap:anywhere]">{project.reraNumber}</span>
      </p>
    </article>
  );
}

export function VisitPage() {
  const { t } = useLanguage();
  const token = useBuyerToken();
  const [cancelled, setCancelled] = useState(false);
  const request = useRequest(
    (signal) => (token ? fetchVisit(token, signal) : Promise.resolve(null)),
    [token],
  );

  const expired = request.error instanceof ApiError && request.error.status === 401;
  useEffect(() => {
    if (expired) clearBuyerToken();
  }, [expired]);

  if (!token) return <Navigate to="/" replace />;

  const visit = request.data?.visit;

  let content;
  if (cancelled) {
    content = (
      <Notice
        text={t.cancelled}
        actionLabel={t.bookVisit}
        to="/chat"
        state={{ intent: 'book', projectCode: visit?.project.code }}
      />
    );
  } else if (request.status === 'loading') {
    content = <VisitSkeleton />;
  } else if (request.status === 'error') {
    content = (
      <ErrorState
        title={t.loadVisitFailed}
        message={request.error.message}
        onRetry={request.reload}
        retryLabel={t.retry}
      />
    );
  } else if (!visit) {
    content = (
      <Notice text={t.noVisit} actionLabel={t.bookVisit} to="/chat" state={{ intent: 'book' }} />
    );
  } else {
    content = <VisitDetails visit={visit} onCancelled={() => setCancelled(true)} />;
  }

  return (
    <BuyerShell projectCode={visit?.project.code}>
      <div className="mx-auto max-w-xl px-5 pt-4 pb-16 sm:px-8 sm:pt-10">{content}</div>
    </BuyerShell>
  );
}
