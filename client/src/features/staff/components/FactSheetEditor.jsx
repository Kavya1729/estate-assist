import { useState } from 'react';
import { BookOpenText, Building2, CheckCircle2, LayoutGrid, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { updateProject } from '../api';
import {
  emptyConfiguration,
  emptyFact,
  factKeyFrom,
  snapshot,
  toForm,
  toPayload,
  validateForm,
} from '../factSheetForm';
import { useAction } from '../hooks/useAction';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { ConfigurationsEditor } from './ConfigurationsEditor';
import { FactsEditor } from './FactsEditor';
import { InlineError, Section } from './Section';

function Field({ id, label, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

const replaceRow = (rows, uid, patch) =>
  rows.map((row) => (row.uid === uid ? { ...row, ...patch } : row));

function withFactKey(fact, patch) {
  const next = { ...fact, ...patch };
  if (next.isNew && !next.keyEdited && patch.label !== undefined)
    next.key = factKeyFrom(next.label);
  return next;
}

/** The sales head's editor for everything the assistant may tell buyers about a project. */
export function FactSheetEditor({ project, onSaved }) {
  const [baseline, setBaseline] = useState(() => toForm(project));
  const [form, setForm] = useState(baseline);
  const [checked, setChecked] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const { pending, error, run, clearError } = useAction();

  const dirty = snapshot(form) !== snapshot(baseline);
  const errors = checked ? validateForm(form) : {};
  const errorCount = Object.keys(errors).length;
  const blocker = useUnsavedChanges(dirty);

  function edit(change) {
    setForm((current) => ({ ...current, ...change(current) }));
    setSavedAt(null);
    clearError();
  }

  async function save() {
    setChecked(true);
    if (Object.keys(validateForm(form)).length) return;
    await run('save', async () => {
      const { project: next } = await updateProject(project.code, toPayload(form));
      const nextForm = toForm(next);
      setBaseline(nextForm);
      setForm(nextForm);
      setChecked(false);
      setSavedAt(Date.now());
      onSaved?.(next);
    });
  }

  function discard() {
    setForm(baseline);
    setChecked(false);
    clearError();
  }

  return (
    <div className="space-y-5">
      <Section title="Project" icon={Building2}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="project-name" label="Name" error={errors.name}>
            <Input
              id="project-name"
              value={form.name}
              maxLength={80}
              aria-invalid={Boolean(errors.name) || undefined}
              onChange={(e) => edit(() => ({ name: e.target.value }))}
            />
          </Field>
          <Field
            id="project-possession"
            label="Possession"
            hint="Shown to buyers as the month and year."
          >
            <Input
              id="project-possession"
              type="date"
              value={form.possessionDate}
              onChange={(e) => edit(() => ({ possessionDate: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field id="project-tagline" label="Tagline" hint="One line on the buyer landing page.">
              <Input
                id="project-tagline"
                value={form.tagline}
                maxLength={160}
                onChange={(e) => edit(() => ({ tagline: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex items-start gap-2.5 sm:col-span-2">
            <Checkbox
              id="project-active"
              checked={form.isActive}
              onCheckedChange={(value) => edit(() => ({ isActive: value === true }))}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="project-active">Open for enquiries</Label>
              <p className="text-xs text-muted-foreground">
                When off, the project leaves the website and the assistant stops offering visits.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="BHK types and prices"
        icon={LayoutGrid}
        description="The only prices and sizes the assistant may quote. A reply with any other number is blocked."
      >
        <ConfigurationsEditor
          rows={form.configurations}
          errors={errors}
          onChange={(uid, patch) =>
            edit((f) => ({ configurations: replaceRow(f.configurations, uid, patch) }))
          }
          onAdd={() =>
            edit((f) => ({ configurations: [...f.configurations, emptyConfiguration()] }))
          }
          onRemove={(uid) =>
            edit((f) => ({ configurations: f.configurations.filter((row) => row.uid !== uid) }))
          }
        />
      </Section>

      <Section
        title="Facts"
        icon={BookOpenText}
        description="Amenities, RERA, payment plans, possession and so on. A question these do not answer goes to a person."
      >
        <FactsEditor
          facts={form.facts}
          errors={errors}
          onChange={(uid, patch) =>
            edit((f) => ({
              facts: f.facts.map((fact) => (fact.uid === uid ? withFactKey(fact, patch) : fact)),
            }))
          }
          onAdd={() => edit((f) => ({ facts: [emptyFact(), ...f.facts] }))}
          onRemove={(uid) => edit((f) => ({ facts: f.facts.filter((fact) => fact.uid !== uid) }))}
        />
      </Section>

      {(dirty || savedAt || blocker.state === 'blocked') && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {blocker.state === 'blocked' ? (
            <div className="flex flex-wrap items-center justify-between gap-2" role="alertdialog">
              <p className="text-sm font-medium">Leave without saving your changes?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => blocker.reset()}>
                  Keep editing
                </Button>
                <Button size="sm" variant="destructive" onClick={() => blocker.proceed()}>
                  Discard changes
                </Button>
              </div>
            </div>
          ) : dirty ? (
            <div className="space-y-2">
              <InlineError>
                {error ??
                  (errorCount > 0 &&
                    `Fix the ${errorCount} highlighted ${errorCount === 1 ? 'field' : 'fields'} to save.`)}
              </InlineError>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Unsaved changes</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" disabled={Boolean(pending)} onClick={discard}>
                    Discard
                  </Button>
                  <Button size="sm" disabled={Boolean(pending)} onClick={save}>
                    {pending && <Loader2 className="animate-spin" />} Save fact sheet
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-emerald-700" role="status">
              <CheckCircle2 className="size-4" aria-hidden /> Saved. The assistant uses it from the
              next message.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
