import { RouterProvider } from 'react-router';

import { LanguageProvider } from '@/features/buyer/LanguageProvider';
import { router } from '@/router';

export default function App() {
  return (
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  );
}
