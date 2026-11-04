import { cn } from '@/lib/utils';

import { useCatalog } from '../hooks/useCatalog';
import { useLanguage } from '../language';

/**
 * RERA requires promotional pages to show the project registration number.
 * `projectCode` narrows it to one project; `compact` is the one-line chat version.
 */
export function ReraFooter({ projectCode, compact = false, className }) {
  const { t } = useLanguage();
  const { projects } = useCatalog();
  const shown = projectCode ? projects.filter((p) => p.code === projectCode) : projects;

  if (compact) {
    return (
      <p className={cn('text-center text-[11px] leading-relaxed text-muted-foreground', className)}>
        {shown.map((p) => (
          <span key={p.code} className="mx-1.5 inline-block max-w-full">
            {p.name} · {t.rera}{' '}
            <span className="font-mono [overflow-wrap:anywhere]">{p.reraNumber}</span>
          </span>
        ))}
      </p>
    );
  }

  return (
    <footer className={cn('border-t', className)}>
      <div className="mx-auto max-w-6xl space-y-3 px-5 py-8 text-xs text-muted-foreground sm:px-8">
        <p className="font-medium tracking-wide text-foreground uppercase">{t.footerRera}</p>
        <ul className="space-y-1">
          {shown.map((p) => (
            <li key={p.code}>
              {p.name} · <span className="font-mono [overflow-wrap:anywhere]">{p.reraNumber}</span>
            </li>
          ))}
        </ul>
        <p className="max-w-2xl leading-relaxed">{t.footerNote}</p>
      </div>
    </footer>
  );
}
