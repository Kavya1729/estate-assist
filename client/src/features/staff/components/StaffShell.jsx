import { useEffect, useRef } from 'react';
import { Building2, ChartColumn, Copy, LogOut, ShieldAlert, Users } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { endStaffSession, isSalesHead, useStaffUser } from '../session';

const ROLE_LABELS = { sales_head: 'Sales head', sales_executive: 'Sales executive' };

function navItems(user) {
  return [
    { to: '/staff/leads', label: 'Leads', icon: Users },
    { to: '/staff/reviews', label: 'Review', icon: ShieldAlert },
    { to: '/staff/duplicates', label: 'Duplicates', icon: Copy },
    ...(isSalesHead(user)
      ? [
          { to: '/staff/projects', label: 'Projects', icon: Building2 },
          { to: '/staff/dashboard', label: 'Dashboard', icon: ChartColumn },
        ]
      : []),
  ];
}

function NavItem({ to, label, icon: Icon, compact }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex shrink-0 items-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
          compact ? 'px-3 py-1.5' : 'px-3 py-2',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        )
      }
    >
      <Icon className="size-4" aria-hidden /> {label}
    </NavLink>
  );
}

/** Sidebar on wide screens, a compact top bar with tabs on phones. */
export function StaffShell() {
  const user = useStaffUser();
  const items = navItems(user);
  const signOut = () => endStaffSession();
  const { pathname } = useLocation();
  const tabsRef = useRef(null);

  // On phones the tab row scrolls sideways; keep the current page's tab in view
  // (again once the web font loads, since it changes the tab widths).
  useEffect(() => {
    const reveal = () =>
      tabsRef.current
        ?.querySelector('[aria-current="page"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    reveal();
    document.fonts?.ready.then(reveal);
  }, [pathname]);

  return (
    <div className="min-h-svh md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh flex-col border-r bg-card/60 px-4 py-6 md:flex">
        <Link to="/staff/leads" className="px-3 font-serif text-lg tracking-tight">
          Estate Assist
          <span className="block font-sans text-xs font-normal tracking-normal text-muted-foreground">
            Sales console
          </span>
        </Link>
        <nav aria-label="Staff" className="mt-8 flex flex-col gap-1">
          {items.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t px-3 pt-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[user?.role]}</p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
            <LogOut /> Sign out
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link to="/staff/leads" className="font-serif text-base tracking-tight">
            Estate Assist
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs text-muted-foreground">{user?.name}</span>
            <Button variant="ghost" size="icon-sm" onClick={signOut} aria-label="Sign out">
              <LogOut />
            </Button>
          </div>
        </div>
        {items.length > 1 && (
          <nav
            ref={tabsRef}
            aria-label="Staff"
            className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <NavItem key={item.to} {...item} compact />
            ))}
          </nav>
        )}
      </header>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
