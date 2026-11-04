import { useLanguage } from '../language';

export function TypingIndicator() {
  const { t } = useLanguage();

  return (
    <div className="flex items-start" role="status" aria-label={t.typing}>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border bg-card px-4 py-3.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="typing-dot size-1.5 rounded-full bg-muted-foreground"
            style={{ animationDelay: `${dot * 160}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
