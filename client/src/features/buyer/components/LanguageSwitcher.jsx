import { cn } from '@/lib/utils';

import { useLanguage } from '../language';
import { LANGUAGES } from '../strings';

export function LanguageSwitcher({ className }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn('inline-flex rounded-full border bg-card p-0.5 text-xs', className)}
    >
      {LANGUAGES.map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.code}
          title={option.label}
          aria-pressed={language === option.code}
          onClick={() => setLanguage(option.code)}
          className={cn(
            'min-w-8 cursor-pointer rounded-full px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:text-foreground',
            language === option.code &&
              'bg-primary text-primary-foreground hover:text-primary-foreground',
          )}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
