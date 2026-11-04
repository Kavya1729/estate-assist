import { createBrowserRouter, Navigate } from 'react-router';

import { NotFoundPage } from '@/pages/NotFoundPage';
import { ChatPage } from '@/pages/buyer/ChatPage';
import { LandingPage } from '@/pages/buyer/LandingPage';
import { VisitPage } from '@/pages/buyer/VisitPage';

/** Staff screens load on demand so buyers never download the console. */
const staffPage = (load, name) => async () => ({ Component: (await load())[name] });

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/chat', element: <ChatPage /> },
  { path: '/visit', element: <VisitPage /> },
  { path: '/staff/login', lazy: staffPage(() => import('@/pages/staff/LoginPage'), 'LoginPage') },
  {
    path: '/staff',
    lazy: staffPage(() => import('@/features/staff/components/StaffLayout'), 'StaffLayout'),
    children: [
      { index: true, element: <Navigate to="leads" replace /> },
      { path: 'leads', lazy: staffPage(() => import('@/pages/staff/LeadsPage'), 'LeadsPage') },
      {
        path: 'leads/:id',
        lazy: staffPage(() => import('@/pages/staff/LeadDetailPage'), 'LeadDetailPage'),
      },
      {
        path: 'dashboard',
        lazy: staffPage(() => import('@/pages/staff/DashboardPage'), 'DashboardPage'),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
