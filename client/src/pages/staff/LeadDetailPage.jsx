import { ArrowLeft, Lock, SearchX } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AiSummaryCard } from '@/features/staff/components/AiSummaryCard';
import { ConversationPanel } from '@/features/staff/components/ConversationPanel';
import { DuplicatesCard } from '@/features/staff/components/DuplicatesCard';
import { HandoffBanner, LeadHeader } from '@/features/staff/components/LeadHeader';
import { OutboxCard } from '@/features/staff/components/OutboxCard';
import { ProfileCard } from '@/features/staff/components/ProfileCard';
import { VisitsCard } from '@/features/staff/components/VisitsCard';
import { useExecutives } from '@/features/staff/hooks/useLeads';
import { useLeadDetail } from '@/features/staff/hooks/useLeadDetail';
import { isSalesHead, useStaffUser } from '@/features/staff/session';
import { useNow } from '@/hooks/useNow';

function BackLink() {
  const location = useLocation();
  return (
    <Link
      to={location.state?.from ?? '/staff/leads'}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> All leads
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading lead">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          {[60, 75, 50, 70].map((width, i) => (
            <div key={i} className={i % 2 ? 'flex justify-end' : 'flex'}>
              <Skeleton className="h-14 rounded-2xl" style={{ width: `${width}%` }} />
            </div>
          ))}
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="space-y-5">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border bg-card p-5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadError({ error, onRetry }) {
  if (error.status === 404) {
    return (
      <EmptyState
        icon={SearchX}
        title="Lead not found"
        message="It may have been merged into another lead. Search for the buyer in the lead list."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/staff/leads">Back to leads</Link>
          </Button>
        }
      />
    );
  }
  if (error.status === 403) {
    return (
      <EmptyState
        icon={Lock}
        title="This lead belongs to another executive"
        message={error.message}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/staff/leads">Back to your leads</Link>
          </Button>
        }
      />
    );
  }
  return <ErrorState title="Could not load this lead" message={error.message} onRetry={onRetry} />;
}

export function LeadDetailPage() {
  const { id } = useParams();
  const user = useStaffUser();
  const head = isSalesHead(user);
  const detail = useLeadDetail(id);
  const executives = useExecutives(head);
  const now = useNow(30_000);

  if (detail.status === 'loading') {
    return (
      <div className="space-y-5">
        <BackLink />
        <DetailSkeleton />
      </div>
    );
  }

  if (detail.status === 'error') {
    return (
      <div className="space-y-5">
        <BackLink />
        <LoadError error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }

  const { lead, visits, conversations, outbox } = detail.data;
  const refresh = detail.refresh;

  return (
    <div className="space-y-5">
      <BackLink />
      <LeadHeader
        lead={lead}
        executives={head ? (executives.data?.items ?? null) : null}
        now={now}
        onChanged={refresh}
      />
      <HandoffBanner
        lead={lead}
        canTakeOver={conversations.length > 0}
        now={now}
        onChanged={refresh}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <AiSummaryCard lead={lead} className="xl:hidden" />
          <ConversationPanel
            key={lead.id}
            lead={lead}
            conversations={conversations}
            onChanged={refresh}
          />
        </div>
        <div className="min-w-0 space-y-5">
          <AiSummaryCard lead={lead} className="hidden xl:block" />
          <VisitsCard visits={visits} now={now} onChanged={refresh} />
          <OutboxCard messages={outbox} />
          <DuplicatesCard lead={lead} onChanged={refresh} />
          <ProfileCard lead={lead} />
        </div>
      </div>
    </div>
  );
}
