import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { BuyerShell } from '@/features/buyer/components/BuyerShell';
import { useLanguage } from '@/features/buyer/language';

export function NotFoundPage() {
  const { t } = useLanguage();

  return (
    <BuyerShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-5 py-24 text-center">
        <p className="font-serif text-6xl text-muted-foreground">404</p>
        <p className="text-lg">{t.notFound}</p>
        <Button asChild size="lg">
          <Link to="/">{t.home}</Link>
        </Button>
      </div>
    </BuyerShell>
  );
}
