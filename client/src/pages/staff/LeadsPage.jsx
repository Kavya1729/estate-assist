import { useState } from 'react';
import { Inbox, SearchX, X } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/button';
import { LeadFilters } from '@/features/staff/components/LeadFilters';
import { LeadList, LeadListSkeleton } from '@/features/staff/components/LeadList';
import { Pagination } from '@/features/staff/components/Pagination';
import {
  PAGE_SIZE,
  useExecutives,
  useLeadFilters,
  useLeads,
} from '@/features/staff/hooks/useLeads';
import { isSalesHead, useStaffUser } from '@/features/staff/session';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/utils';

export function LeadsPage() {
  const user = useStaffUser();
  const head = isSalesHead(user);
  const { filters, sort, page, activeCount, update, clear } = useLeadFilters();
  const leads = useLeads({ filters, sort, page });
  const executives = useExecutives(head);
  const now = useNow();
  const [resetKey, setResetKey] = useState(0);

  function clearFilters() {
    clear();
    setResetKey((k) => k + 1);
  }

  function changePage(next) {
    update({ page: next > 1 ? next : '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const total = leads.data?.total;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {head ? 'Every lead across both projects.' : 'Leads assigned to you.'}
            {total != null && ` ${total} ${total === 1 ? 'lead' : 'leads'}.`}
          </p>
        </div>
      </header>

      <LeadFilters
        filters={filters}
        sort={sort}
        activeCount={activeCount}
        onChange={update}
        onClear={clearFilters}
        resetKey={resetKey}
        executives={head ? (executives.data?.items ?? []) : null}
      />

      {leads.status === 'loading' && <LeadListSkeleton />}

      {leads.status === 'error' && (
        <ErrorState
          title="Could not load leads"
          message={leads.error.message}
          onRetry={leads.reload}
        />
      )}

      {leads.status === 'ready' &&
        leads.data.items.length === 0 &&
        (activeCount > 0 ? (
          <EmptyState
            icon={SearchX}
            title="No leads match these filters"
            message="Try a different search or clear the filters to see every lead."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X /> Clear filters
              </Button>
            }
          />
        ) : page > 1 ? (
          <EmptyState
            icon={Inbox}
            title="This page is empty"
            action={
              <Button variant="outline" size="sm" onClick={() => changePage(1)}>
                Go to the first page
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title={head ? 'No leads yet' : 'No leads assigned to you yet'}
            message={
              head
                ? 'Leads from property portals, social ads, the website and hoarding calls appear here as they arrive.'
                : 'New leads are assigned automatically. They will show up here with their chat.'
            }
          />
        ))}

      {leads.status === 'ready' && leads.data.items.length > 0 && (
        <div
          className={cn('space-y-5 transition-opacity', leads.stale && 'opacity-60')}
          aria-busy={leads.stale}
        >
          <LeadList items={leads.data.items} showOwner={head} now={now} />
          <Pagination
            page={leads.data.page}
            pages={leads.data.pages}
            total={leads.data.total}
            pageSize={PAGE_SIZE}
            onPageChange={changePage}
          />
        </div>
      )}
    </div>
  );
}
