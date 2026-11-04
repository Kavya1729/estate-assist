import {
  CalendarCheck,
  ChartNoAxesColumn,
  Clock,
  Copy,
  IndianRupee,
  Lock,
  MessageCircleWarning,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart } from '@/features/staff/components/BarChart';
import { Section } from '@/features/staff/components/Section';
import { SourceTable } from '@/features/staff/components/SourceTable';
import { StatCard } from '@/features/staff/components/StatCard';
import { RANGES, useDashboard } from '@/features/staff/hooks/useDashboard';
import { SOURCES } from '@/features/staff/labels';
import { isSalesHead, useStaffUser } from '@/features/staff/session';
import {
  formatDayMonth,
  formatDuration,
  formatMonthYear,
  formatPercent,
  formatRupees,
} from '@/lib/format';
import { cn } from '@/lib/utils';

const money = (value) => (value == null ? '—' : formatRupees(value));

function RangePicker({ value, onChange }) {
  return (
    <div
      className="grid w-full grid-cols-4 rounded-lg border bg-card p-0.5 sm:inline-flex sm:w-auto"
      role="group"
      aria-label="Date range"
    >
      {RANGES.map((range) => (
        <button
          key={range.key}
          type="button"
          aria-pressed={value === range.key}
          onClick={() => onChange(range.key)}
          className={cn(
            'rounded-md px-1 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-3 sm:text-sm',
            value === range.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

function QueueLink({ to, icon: Icon, count, label }) {
  const body = (
    <>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 text-sm">{label}</span>
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums',
          count ? 'bg-rose-50 text-rose-700' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </>
  );
  const className = 'flex items-center gap-3 rounded-xl border bg-card px-4 py-3';
  return to ? (
    <Link to={to} className={cn(className, 'transition-colors hover:border-primary/30')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function sourceRow(row) {
  return {
    key: row.source,
    label: SOURCES[row.source]?.label ?? row.source,
    dot: SOURCES[row.source]?.dot,
  };
}

function Charts({ bySource, responseTargetSeconds }) {
  const target = formatDuration(responseTargetSeconds);
  const withVisits = bySource.filter((r) => r.costPerVisit != null);
  const cheapest = withVisits.length
    ? withVisits.reduce((best, r) => (r.costPerVisit < best.costPerVisit ? r : best))
    : null;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Leads by source" description="Hot leads are the darker part of each bar">
        <BarChart
          rows={bySource.map((r) => ({
            ...sourceRow(r),
            display: `${r.leads}`,
            hint: `${r.hotLeads} hot (${formatPercent(r.leads ? r.hotLeads / r.leads : null)})`,
            segments: [
              { label: 'Hot', value: r.hotLeads, className: 'bg-primary' },
              { label: 'Warm or cold', value: r.leads - r.hotLeads, className: 'bg-primary/35' },
            ],
          }))}
          legend={[
            { label: 'Hot', className: 'bg-primary' },
            { label: 'Warm or cold', className: 'bg-primary/35' },
          ]}
        />
      </Section>

      <Section
        title="Cost per site visit"
        description={
          cheapest
            ? `Lowest: ${SOURCES[cheapest.source]?.label} at ${formatRupees(cheapest.costPerVisit)} a visit`
            : 'Spend divided by visits that happened'
        }
      >
        <BarChart
          rows={bySource.map((r) => ({
            ...sourceRow(r),
            display: r.costPerVisit == null ? 'No visits yet' : formatRupees(r.costPerVisit),
            hint: `Spend ${money(r.spend)} · ${money(r.costPerLead)} per lead`,
            segments: [
              {
                label: 'Cost per visit',
                value: r.costPerVisit ?? 0,
                className: 'bg-[oklch(0.72_0.12_70)]',
              },
            ],
          }))}
        />
      </Section>

      <Section
        title={`Answered within ${target}`}
        description="Share of leads that got a first reply within the target"
      >
        <BarChart
          max={1}
          rows={bySource.map((r) => ({
            ...sourceRow(r),
            display: formatPercent(r.respondedWithinTarget),
            hint: `Median first reply ${formatDuration(r.medianFirstResponseSeconds)} · ${r.responded} of ${r.leads} answered`,
            segments: [
              {
                label: 'Within target',
                value: r.respondedWithinTarget ?? 0,
                className:
                  (r.respondedWithinTarget ?? 0) >= 0.8 ? 'bg-emerald-600' : 'bg-orange-500',
              },
            ],
          }))}
          legend={[
            { label: '80% or more', className: 'bg-emerald-600' },
            { label: 'Below 80%', className: 'bg-orange-500' },
          ]}
        />
      </Section>

      <Section title="Site visits" description="Booked visits by what happened to them">
        <BarChart
          rows={bySource.map((r) => ({
            ...sourceRow(r),
            display: `${r.visitsBooked} booked`,
            hint: `${r.visited} visited · ${r.noShows} no-show · show-up ${formatPercent(r.showUpRate)}`,
            segments: [
              { label: 'Visited', value: r.visited, className: 'bg-emerald-600' },
              { label: 'No-show', value: r.noShows, className: 'bg-orange-500' },
              {
                label: 'Upcoming or cancelled',
                value: Math.max(0, r.visitsBooked - r.visited - r.noShows),
                className: 'bg-primary/30',
              },
            ],
          }))}
          legend={[
            { label: 'Visited', className: 'bg-emerald-600' },
            { label: 'No-show', className: 'bg-orange-500' },
            { label: 'Upcoming or cancelled', className: 'bg-primary/30' },
          ]}
        />
      </Section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-2/5" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-4 rounded-xl border bg-card p-5">
            <Skeleton className="h-4 w-32" />
            {[80, 60, 45, 70].map((w) => (
              <div key={w} className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 rounded-full" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ data }) {
  const { totals, bySource, queues, range, responseTargetSeconds } = data;
  const target = formatDuration(responseTargetSeconds);
  const spendMonths = range.spendMonths.map((m) => formatMonthYear(`${m}-15`)).join(', ');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="Leads" value={totals.leads} hint={`${totals.hotLeads} hot`} />
        <StatCard
          icon={Clock}
          label="Median first reply"
          value={formatDuration(totals.medianFirstResponseSeconds)}
          hint={`${formatPercent(totals.respondedWithinTarget)} within ${target}`}
        />
        <StatCard
          icon={CalendarCheck}
          label="Visits booked"
          value={totals.visitsBooked}
          hint={`${totals.visited} visited · ${formatPercent(totals.showUpRate)} show-up`}
        />
        <StatCard
          icon={IndianRupee}
          label="Marketing spend"
          value={money(totals.spend)}
          hint={`${money(totals.costPerLead)} per lead · ${money(totals.costPerVisit)} per visit`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QueueLink
          to="/staff/leads?handoff=pending"
          icon={MessageCircleWarning}
          count={queues.pendingHandoffs}
          label="Chats waiting for a person"
        />
        <QueueLink
          to="/staff/leads?duplicates=open"
          icon={Copy}
          count={queues.openDuplicates}
          label="Possible duplicates to check"
        />
        <QueueLink
          icon={ShieldAlert}
          count={queues.pendingReviews}
          label="Replies blocked by guardrails"
        />
      </div>

      <Charts bySource={bySource} responseTargetSeconds={responseTargetSeconds} />

      <div className="space-y-2">
        <h2 className="font-sans text-sm font-semibold tracking-normal">All numbers by source</h2>
        <SourceTable rows={bySource} totals={totals} />
        <p className="text-xs text-muted-foreground">
          Leads count once, under the source they first came from. Spend is monthly, so it covers
          whole months: {spendMonths}.
        </p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const user = useStaffUser();
  const head = isSalesHead(user);

  if (!head) {
    return (
      <EmptyState
        icon={Lock}
        title="Only the sales head can see the dashboard"
        message="It includes marketing spend for the whole company. Your leads are in the lead list."
        action={
          <Link to="/staff/leads" className="text-sm underline underline-offset-4">
            Go to your leads
          </Link>
        }
      />
    );
  }

  return <HeadDashboard />;
}

function HeadDashboard() {
  const dashboard = useDashboard();
  const { status, data, error, range, setRange, reload } = dashboard;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl">Source dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {status === 'ready'
              ? `${formatDayMonth(data.range.from)} – ${formatDayMonth(data.range.to)}: where leads come from and what they cost.`
              : 'Where leads come from and what they cost.'}
          </p>
        </div>
        <RangePicker value={range} onChange={setRange} />
      </header>

      {status === 'loading' && <DashboardSkeleton />}

      {status === 'error' && (
        <ErrorState title="Could not load the dashboard" message={error.message} onRetry={reload} />
      )}

      {status === 'ready' &&
        (data.totals.leads === 0 ? (
          <EmptyState
            icon={ChartNoAxesColumn}
            title="No leads in this range"
            message="Pick a longer range to see how each source is doing."
          />
        ) : (
          <Dashboard data={data} />
        ))}
    </div>
  );
}
