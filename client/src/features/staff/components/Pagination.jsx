import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function Pagination({ page, pages, total, pageSize, onPageChange }) {
  if (pages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="text-muted-foreground tabular-nums">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}
