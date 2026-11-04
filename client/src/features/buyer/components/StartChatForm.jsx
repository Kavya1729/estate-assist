import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { startChat } from '../api';
import { useLanguage } from '../language';
import { isIndianMobile } from '../phone';
import { saveBuyerToken } from '../session';

const FIELD_OF = { 'body.name': 'name', 'body.phone': 'phone', 'body.consent': 'consent' };

/**
 * Name, mobile and project, with explicit consent before we store the number
 * (DPDP Act). Starting a chat creates or updates the lead like any other source.
 */
export function StartChatForm({ projects, projectCode, onProjectChange, onStarted, nameRef }) {
  const { t, language } = useLanguage();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const clearError = (field) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  function validate() {
    const found = {};
    if (!name.trim()) found.name = t.nameRequired;
    if (!isIndianMobile(phone)) found.phone = t.phoneInvalid;
    if (!consent) found.consent = t.consentRequired;
    return found;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const { token } = await startChat({
        name: name.trim(),
        phone,
        consent: true,
        language,
        ...(projectCode && { projectCode }),
      });
      saveBuyerToken(token);
      onStarted();
    } catch (err) {
      const fieldErrors = Object.fromEntries(
        (err.details ?? [])
          .filter((d) => FIELD_OF[d.field])
          .map((d) => [FIELD_OF[d.field], d.message]),
      );
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length) setFormError(err.message);
      setSubmitting(false);
    }
  }

  const choices = [
    ...projects.map((p) => ({ code: p.code, label: p.name })),
    { code: null, label: t.anyProject },
  ];

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="buyer-name">{t.name}</Label>
        <Input
          id="buyer-name"
          ref={nameRef}
          autoComplete="name"
          placeholder={t.namePlaceholder}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            clearError('name');
          }}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'buyer-name-error' : undefined}
          className="h-11"
        />
        {errors.name && (
          <p id="buyer-name-error" className="text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="buyer-phone">{t.phone}</Label>
        <div className="flex">
          <span className="inline-flex h-11 items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
            +91
          </span>
          <Input
            id="buyer-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={t.phonePlaceholder}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              clearError('phone');
            }}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'buyer-phone-error' : undefined}
            className="h-11 rounded-l-none"
          />
        </div>
        {errors.phone && (
          <p id="buyer-phone-error" className="text-xs text-destructive">
            {errors.phone}
          </p>
        )}
      </div>

      {projects.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">{t.project}</legend>
          <div className="flex flex-wrap gap-2">
            {choices.map((choice) => (
              <button
                key={choice.code ?? 'any'}
                type="button"
                aria-pressed={projectCode === choice.code}
                onClick={() => onProjectChange(choice.code)}
                className={cn(
                  'cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-colors hover:border-primary/40',
                  projectCode === choice.code &&
                    'border-primary bg-primary text-primary-foreground',
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="buyer-consent"
            checked={consent}
            onCheckedChange={(value) => {
              setConsent(value === true);
              clearError('consent');
            }}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? 'buyer-consent-error' : undefined}
            className="mt-0.5"
          />
          <Label
            htmlFor="buyer-consent"
            className="cursor-pointer text-xs leading-relaxed font-normal text-muted-foreground"
          >
            {t.consent}
          </Label>
        </div>
        {errors.consent && (
          <p id="buyer-consent-error" className="text-xs text-destructive">
            {errors.consent}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="animate-spin" /> {t.starting}
          </>
        ) : (
          <>
            {t.startChat} <ArrowRight />
          </>
        )}
      </Button>
    </form>
  );
}
