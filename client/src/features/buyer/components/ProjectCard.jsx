import { CalendarCheck, MapPin, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatMonthYear, formatRupeeRange } from '@/lib/format';

import { useLanguage } from '../language';

export function ProjectCard({ project, onAsk, onBook }) {
  const { t, language } = useLanguage();
  const amenities = project.facts.find((f) => f.key === 'amenities')?.value;

  return (
    <article className="rounded-2xl border bg-card p-6 shadow-xs sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="space-y-1.5">
          <h3 className="text-2xl">{project.name}</h3>
          {project.tagline && <p className="text-muted-foreground">{project.tagline}</p>}
        </div>
        {project.possessionDate && (
          <p className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">
            {t.possession(formatMonthYear(project.possessionDate, language))}
          </p>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{`${project.location.address}, ${project.location.city}`}</span>
      </p>

      <dl className="mt-6 divide-y border-y">
        {project.configurations.map((c) => (
          <div
            key={c.bhk}
            className="grid grid-cols-[4.5rem_1fr] items-baseline gap-3 py-3 sm:grid-cols-[5rem_1fr_auto]"
          >
            <dt className="font-medium">{t.bhk(c.bhk)}</dt>
            <dd className="text-sm text-muted-foreground">
              {t.sqft(c.carpetAreaSqft.min, c.carpetAreaSqft.max)}
              {c.unitsAvailable != null && (
                <span className="block text-xs sm:inline sm:before:mx-2 sm:before:content-['·']">
                  {t.unitsLeft(c.unitsAvailable)}
                </span>
              )}
            </dd>
            <dd className="col-start-2 font-serif text-base min-[360px]:text-lg sm:col-start-auto sm:text-right">
              {formatRupeeRange(c.priceRange)}
            </dd>
          </div>
        ))}
      </dl>

      {amenities && (
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
          {amenities}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={() => onBook(project.code)}>
          <CalendarCheck /> {t.bookVisit}
        </Button>
        <Button size="lg" variant="outline" className="flex-1" onClick={() => onAsk(project.code)}>
          <MessageCircle /> {t.askAbout}
        </Button>
      </div>

      <p className="mt-5 text-[11px] text-muted-foreground">
        {t.rera} <span className="font-mono [overflow-wrap:anywhere]">{project.reraNumber}</span>
      </p>
    </article>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-6 sm:p-8" aria-hidden>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
