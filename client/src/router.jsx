import { createBrowserRouter } from 'react-router';

import { NotFoundPage } from '@/pages/NotFoundPage';
import { ChatPage } from '@/pages/buyer/ChatPage';
import { LandingPage } from '@/pages/buyer/LandingPage';
import { VisitPage } from '@/pages/buyer/VisitPage';

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/chat', element: <ChatPage /> },
  { path: '/visit', element: <VisitPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
