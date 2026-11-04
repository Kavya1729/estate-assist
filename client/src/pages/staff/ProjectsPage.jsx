import { Building2, Lock } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { FactSheetEditor } from '@/features/staff/components/FactSheetEditor';
import { SlotManager } from '@/features/staff/components/SlotManager';
import { useProjects } from '@/features/staff/hooks/useProjects';
import { isSalesHead, useStaffUser } from '@/features/staff/session';
import { cn } from '@/lib/utils';

const TABS = [
  { key: 'facts', label: 'Fact sheet' },
  { key: 'slots', label: 'Visit slots' },
];

function Segmented({ label, options, value, onChange }) {
  return (
    <div
      className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-card p-0.5 [scrollbar-width:none]"
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
            value === option.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
          {option.hint && <span className="text-xs font-normal opacity-70">{option.hint}</span>}
        </button>
      ))}
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading projects">
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-9 w-48" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
          <Skeleton className="h-4 w-32" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
          <Skeleton className="h-9" />
        </div>
      ))}
    </div>
  );
}

export function ProjectsPage() {
  const head = isSalesHead(useStaffUser());

  if (!head) {
    return (
      <EmptyState
        icon={Lock}
        title="Only the sales head can edit projects"
        message="The fact sheet and visit slots decide what the assistant tells every buyer, so changes go through the sales head."
        action={
          <Link to="/staff/leads" className="text-sm underline underline-offset-4">
            Go to your leads
          </Link>
        }
      />
    );
  }
  return <ProjectAdmin />;
}

function ProjectAdmin() {
  const projects = useProjects();
  const [params, setParams] = useSearchParams();
  const items = projects.data?.items ?? [];
  const project = items.find((p) => p.code === params.get('project')) ?? items[0];
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'facts';

  const show = (changes) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) next.set(key, value);
        // The week picked in one project's slots does not carry over to the other.
        if (changes.project) next.delete('from');
        return next;
      },
      { replace: true },
    );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl sm:text-3xl">Projects</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The fact sheet is everything the assistant may tell buyers; the slots are the times it can
          book.
        </p>
      </header>

      {projects.status === 'loading' && <ProjectsSkeleton />}

      {projects.status === 'error' && (
        <ErrorState
          title="Could not load the projects"
          message={projects.error.message}
          onRetry={projects.reload}
        />
      )}

      {projects.status === 'ready' && !project && (
        <EmptyState
          icon={Building2}
          title="No projects yet"
          message="Run the seed script to add the two projects."
        />
      )}

      {projects.status === 'ready' && project && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Project"
              value={project.code}
              onChange={(code) => show({ project: code })}
              options={items.map((p) => ({
                key: p.code,
                label: p.name,
                hint: p.isActive ? p.code : 'Closed',
              }))}
            />
            <Segmented
              label="Section"
              value={tab}
              onChange={(key) => show({ tab: key })}
              options={TABS}
            />
          </div>

          {tab === 'facts' ? (
            <FactSheetEditor key={project.code} project={project} onSaved={projects.refresh} />
          ) : (
            <SlotManager key={project.code} project={project} />
          )}
        </>
      )}
    </div>
  );
}
